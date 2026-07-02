import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// This is the correct way to initialize Genkit for use in the application.
// It creates a configured instance of Genkit with the specified plugins.
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
});
