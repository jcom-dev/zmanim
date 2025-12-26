import { auth } from '@clerk/nextjs/server';

interface SessionMetadata {
  metadata?: {
    is_admin?: boolean;
    publisher_access_list?: number[];
  };
}

export default async function DebugAuth() {
  const { userId, sessionClaims, orgRole } = await auth();

  return (
    <div className="p-8 font-mono">
      <h1 className="text-2xl font-bold mb-4">Auth Debug</h1>

      <div className="mb-4">
        <strong>User ID:</strong> {userId || 'Not signed in'}
      </div>

      <div className="mb-4">
        <strong>Org Role:</strong> {orgRole || 'None'}
      </div>

      <div className="mb-4">
        <strong>Session Claims:</strong>
        <pre className="bg-muted p-4 rounded mt-2 overflow-auto">
          {JSON.stringify(sessionClaims, null, 2)}
        </pre>
      </div>

      <div className="mb-4">
        <strong>Is Admin:</strong> {(sessionClaims as SessionMetadata | null)?.metadata?.is_admin ? 'Yes' : 'No'}
      </div>

      <div className="mb-4">
        <strong>Publisher Access List:</strong> {JSON.stringify((sessionClaims as SessionMetadata | null)?.metadata?.publisher_access_list || [])}
      </div>
    </div>
  );
}
