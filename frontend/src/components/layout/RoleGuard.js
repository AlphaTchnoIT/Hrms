'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button, EmptyState } from '@/components/ui';

// Shows the page only if the user's role is allowed
export default function RoleGuard({ roles, children }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return (
      <div className="card mt-10">
        <EmptyState
          icon={ShieldAlert}
          title="Access restricted"
          message="You don't have permission to view this page. Contact your HR team if you think this is a mistake."
          action={
            <Link href="/dashboard">
              <Button variant="secondary">Back to dashboard</Button>
            </Link>
          }
        />
      </div>
    );
  }
  return children;
}
