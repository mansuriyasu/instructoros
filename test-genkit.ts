import { extractLicenseDetails } from './src/ai/flows/extract-license-details';

// Create a dummy 1x1 transparent png data uri
const dummyImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

async function test() {
  try {
    const res = await extractLicenseDetails(dummyImage);
    console.log("Success:", res);
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
