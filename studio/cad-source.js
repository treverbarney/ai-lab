import * as OV from "online-3d-viewer";
const status = document.querySelector("#status"),
  container = document.querySelector("#cad");
const params = new URLSearchParams(location.search),
  file = params.get("file");
const viewer = new OV.EmbeddedViewer(container, {
  backgroundColor: new OV.RGBAColor(23, 24, 23, 255),
  defaultColor: new OV.RGBColor(190, 198, 177),
  onModelLoaded: () => {
    status.textContent = "Model ready · drag to orbit / pinch to zoom";
    document.body.dataset.loaded = "true";
  },
  onModelLoadFailed: () => {
    status.textContent =
      "Could not load this file. Check the format and referenced materials.";
  },
});
if (file) {
  status.textContent = "Loading " + file + "…";
  fetch("/api/download?name=" + encodeURIComponent(file))
    .then((r) => {
      if (!r.ok) throw Error("Artifact unavailable.");
      return r.blob();
    })
    .then((blob) => viewer.LoadModelFromFileList([new File([blob], file)]))
    .catch((e) => (status.textContent = e.message));
} else
  status.textContent = "Choose a CAD artifact from the integration studio.";
window.addEventListener("resize", () => viewer.Resize());
window.addEventListener("beforeunload", () => viewer.Destroy());
