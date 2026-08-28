export type Role = 'student' | 'teacher' | 'admin';

export type Props = { role: Role; section: string; endpoint: string };
export type Localized = { fa: boolean };
