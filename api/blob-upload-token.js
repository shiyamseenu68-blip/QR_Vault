var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// api/blob-upload-token.ts
var blob_upload_token_exports = {};
__export(blob_upload_token_exports, {
  default: () => handler
});
module.exports = __toCommonJS(blob_upload_token_exports);
var import_blob = require("@vercel/blob");
async function handler(request) {
  console.log("[BLOB] token request received");
  console.log("[BLOB] method:", request.method);
  console.log("[BLOB] BLOB_READ_WRITE_TOKEN present:", !!process.env.BLOB_READ_WRITE_TOKEN);
  try {
    const body = await request.json();
    console.log("[BLOB] body parsed successfully");
    console.log("[BLOB] body keys:", Object.keys(body));
    const { filename, contentType, size } = body;
    if (!filename || !contentType) {
      console.error("[BLOB] Missing required fields");
      return Response.json({ error: "Missing filename or contentType" }, { status: 400 });
    }
    console.log("[BLOB] Generating upload URL with handleUploadUrl");
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 10);
    const uniqueFilename = `${timestamp}-${randomId}-${filename}`;
    const blob = await (0, import_blob.put)(uniqueFilename, [], {
      access: "public",
      contentType,
      handleUploadUrl: true
    });
    console.log("[BLOB] Upload URL generated successfully");
    console.log("[BLOB] Upload URL:", blob.url);
    console.log("[BLOB] Filename:", uniqueFilename);
    return Response.json({
      success: true,
      uploadUrl: blob.url,
      filename: uniqueFilename
    });
  } catch (err) {
    console.error("[BLOB] error:", err);
    console.error("[BLOB] error name:", err?.name);
    console.error("[BLOB] error message:", err?.message);
    console.error("[BLOB] error stack:", err?.stack);
    return Response.json({ error: err?.message || "Failed to generate upload token" }, { status: 500 });
  }
}
//# sourceMappingURL=blob-upload-token.js.map
