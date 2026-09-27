import { translations, LanguageCode } from '../translations';

export const getT = (selectedLanguage: LanguageCode) => (key: string, options?: Record<string, any>) => {
  let text = translations[selectedLanguage][key] || translations["en"][key] || key;
  if (options) {
    Object.keys(options).forEach(optKey => {
      text = text.replace(`{{${optKey}}}`, String(options[optKey]));
    });
  }
  return text;
};
