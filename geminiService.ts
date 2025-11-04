import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  // In a real app, you'd handle this more gracefully.
  // For this context, we assume the API_KEY is always available.
  console.warn("API_KEY is not set. Gemini API calls will fail.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });
const model = "gemini-2.5-flash";

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // The result includes the Base64 prefix, which we need to remove
        resolve(reader.result.split(',')[1]);
      } else {
        resolve(''); // Or handle the error appropriately
      }
    };
    reader.readAsDataURL(file);
  });

  const base64Data = await base64EncodedDataPromise;

  return {
    inlineData: {
      data: base64Data,
      mimeType: file.type,
    },
  };
};

export interface MedicineDetails {
  name: string | null;
  expiryDate: string | null;
}

export const extractMedicineDetailsFromImage = async (imageFile: File): Promise<MedicineDetails> => {
  try {
    const imagePart = await fileToGenerativePart(imageFile);
    const prompt = "Extract the medicine name and the expiry date from this image of a medicine package. Respond with the name on the first line and the expiry date in YYYY-MM-DD format on the second line. If a value isn't found, write 'null' for that line. Do not add any other text or formatting.";

    const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [imagePart, { text: prompt }] },
    });

    const text = response.text.trim();
    const [nameLine, dateLine] = text.split('\n').map(line => line.trim());

    const name = nameLine && nameLine.toLowerCase() !== 'null' ? nameLine : null;
    let expiryDate = null;

    if (dateLine && dateLine.toLowerCase() !== 'null' && /^\d{4}-\d{2}-\d{2}$/.test(dateLine)) {
      expiryDate = dateLine;
    }

    return { name, expiryDate };
  } catch (error) {
    console.error("Error extracting medicine details from image:", error);
    return { name: null, expiryDate: null };
  }
};