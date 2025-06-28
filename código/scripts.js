document.addEventListener("DOMContentLoaded", function () {
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const qrResult = document.getElementById("qrResult");
  const linkStatus = document.getElementById("linkStatus");
  let stream = null;
  let scanning = false;

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
    scanning = false;
    document.querySelector("#toggleCamera span").textContent = "Activar";
  }

  function mostrarResultadoQR(data) {
    qrResult.textContent = data;
    let mensaje = "✅ Enlace seguro.";
    let color = "green";

    try {
      const url = new URL(data);
      const host = url.hostname;

      if (url.protocol === "http:") {
        mensaje = "⚠️ Enlace HTTP (inseguro).";
        color = "red";
      }

      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
        mensaje = "⚠️ Enlace a dirección IP (sospechoso).";
        color = "red";
      }

      const dominiosConocidos = ["facebook.com", "google.com", "amazon.com", "twitter.com", "youtube.com", "instagram.com", "linkedin.com", "wikipedia.org", "microsoft.com", "apple.com", "netflix.com", "ebay.com"];
      for (let dominio of dominiosConocidos) {
        const dist = calcularDistancia(host, dominio);
        if (dist > 0 && dist <= 2 && host.length >= 0.75 * dominio.length && host.length <= 1.25 * dominio.length) {
          mensaje = `❌ Posible Typosquatting: Similar a ${dominio}.`;
          color = "red";
          break;
        }
      }

      const dominiosMaliciosos = [
        "phishing.com", "malwaretest.com", "badlink.xyz", "www.cuevana.is",
        "smishtank.com", "ana_251e07-cn3x8h2tb.vercel.app",
        "google-verify.net", "microsoft-support.info"
      ];
      if (dominiosMaliciosos.includes(host)) {
        mensaje = "❌ Dominio conocido como malicioso.";
        color = "red";
      }

      const partes = host.split(".");
      if (partes.length > 3 && !host.endsWith(".co.uk") && !host.endsWith(".com.ar")) {
        mensaje = "⚠️ Múltiples subdominios (posible phishing).";
        color = "orange";
      }

      if (data.length > 100) {
        mensaje = "⚠️ URL muy larga (sospechoso).";
        color = "orange";
      }

      if (/%[0-9a-f]{2}/i.test(url.pathname) && !url.pathname.includes("%")) {
        mensaje = "⚠️ Caracteres codificados en la URL (sospechoso).";
        color = "orange";
      }

    } catch {
      mensaje = "❌ El texto no es un link válido.";
      color = "orange";
    }

    linkStatus.textContent = mensaje;
    linkStatus.style.color = color;
  }

  function calcularDistancia(a, b) {
    const n = a.length, m = b.length, dp = [];
    for (let i = 0; i <= n; i++) dp[i] = [i];
    for (let j = 1; j <= m; j++) dp[0][j] = j;
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[n][m];
  }

  document.getElementById("scanImage").addEventListener("click", () => {
    const file = document.getElementById("imageUpload").files[0];
    if (!file) return alert("Selecciona una imagen");
    if (!file.type.startsWith("image/")) return alert("Solo se permiten imágenes");

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSize = 1024;
        if (img.width > maxSize || img.height > maxSize) {
          const scale = maxSize / Math.max(img.width, img.height);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
        }

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);
        if (code) {
          mostrarResultadoQR(code.data);
        } else {
          qrResult.textContent = "No se detectó ningún QR.";
          linkStatus.textContent = "";
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("toggleCamera").addEventListener("click", async () => {
    const statusText = document.querySelector("#toggleCamera span");
    if (scanning) {
      stopCamera();
      return;
    }

    statusText.textContent = "Cargando...";
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 320 },
          height: { ideal: 240 }
        }
      });

      video.srcObject = stream;
      video.addEventListener("loadedmetadata", () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        scanning = true;
        statusText.textContent = "Desactivar";

        setTimeout(async () => {
          const track = stream.getVideoTracks()[0];
          try {
            await track.applyConstraints({
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 }
            });
            console.log("Resolución mejorada");
          } catch (err) {
            console.warn("No se pudo mejorar resolución:", err.message);
          }
        }, 1000);

        setTimeout(() => {
          function escanear() {
            if (!scanning) return;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, canvas.width, canvas.height);
            if (code) {
              mostrarResultadoQR(code.data);
              stopCamera();
            } else {
              qrResult.textContent = "No se detectó ningún QR.";
              linkStatus.textContent = "";
              requestAnimationFrame(escanear);
            }
          }
          escanear();
        }, 500);
      }, { once: true });
    } catch (e) {
      statusText.textContent = "Activar";
      alert("No se pudo acceder a la cámara: " + e.message);
    }
  });
});