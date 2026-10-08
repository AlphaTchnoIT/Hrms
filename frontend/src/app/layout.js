import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';
import { ConfirmProvider } from '@/components/ui/ConfirmDialog';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata = {
  title: 'PeopleHub HRMS',
  description: 'Human Resource Management System - attendance, leave, payroll and more',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      {/* Browser extensions (e.g. Grammarly) add attributes to <body>; this only silences that one tag's mismatch */}
      <body className="font-sans" suppressHydrationWarning>
        <AuthProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: { fontSize: '14px', borderRadius: '12px', padding: '10px 14px', boxShadow: '0 12px 32px -8px rgba(16,24,40,.18)' },
              success: { iconTheme: { primary: '#059669', secondary: '#fff' } },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
