import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Geist, Geist_Mono, Archivo } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: 'FrameBit — Private Video Review & Collaboration',
  description: 'High-precision video review and collaboration platform powered by Google Drive storage and MongoDB',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const savedTheme = cookieStore.get('framebit_theme')?.value;
  const theme = savedTheme === 'light' ? 'light' : 'dark';

  return (
    <html lang="en" className={`${theme} h-full`} data-theme={theme} style={{ colorScheme: theme }} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} h-full antialiased selection:bg-brand-500/30 selection:text-brand-700 dark:selection:bg-cyan-500/30 dark:selection:text-cyan-300`}>
        <ThemeProvider initialTheme={theme}>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
