import { privateFileName } from "./private-file-model";

/** Browser fallback downloads the authenticated response; no credential-bearing URL is opened. */
export async function presentPrivateFile(blob: Blob, name: string, mode: "preview" | "share" = "share") {
  const filename = privateFileName(blob, name);
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    if (mode === "preview") { anchor.target = "_blank"; anchor.rel = "noopener noreferrer"; }
    else anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // A browser may still be consuming the Blob when the download is handed off.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
