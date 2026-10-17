/* Languages the app can be used in. These are the 11 languages Sarvam AI translates
   (mayura:v1) and transcribes; `speech` is the BCP-47 tag used for voice input. */

export const LANGUAGES = [
  { id: 'en', english: 'English', native: 'English', speech: 'en-IN' },
  { id: 'hi', english: 'Hindi', native: 'हिन्दी', speech: 'hi-IN' },
  { id: 'bn', english: 'Bengali', native: 'বাংলা', speech: 'bn-IN' },
  { id: 'mr', english: 'Marathi', native: 'मराठी', speech: 'mr-IN' },
  { id: 'gu', english: 'Gujarati', native: 'ગુજરાતી', speech: 'gu-IN' },
  { id: 'pa', english: 'Punjabi', native: 'ਪੰਜਾਬੀ', speech: 'pa-IN' },
  { id: 'ta', english: 'Tamil', native: 'தமிழ்', speech: 'ta-IN' },
  { id: 'te', english: 'Telugu', native: 'తెలుగు', speech: 'te-IN' },
  { id: 'kn', english: 'Kannada', native: 'ಕನ್ನಡ', speech: 'kn-IN' },
  { id: 'ml', english: 'Malayalam', native: 'മലയാളം', speech: 'ml-IN' },
  { id: 'od', english: 'Odia', native: 'ଓଡ଼ିଆ', speech: 'or-IN' },
] as const;

export type Language = (typeof LANGUAGES)[number]['id'];

export const languageInfo = (id: string) => LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0];
export const isLanguage = (id: unknown): id is Language => LANGUAGES.some((l) => l.id === id);
