
export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export interface Message {
  role: Role;
  text: string;
}

export interface LanguageOption {
  code: 'en-US' | 'fr-FR' | 'ar-SA';
  name: string;
  dir: 'ltr' | 'rtl';
}
