import { useEffect, useState } from 'react';
import { todoApi, type VelocityResponse } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function VelocityDisplay() {
  const [velocity, setVelocity] = useState<VelocityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVelocity = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await todoApi.getVelocity();
        setVelocity(data);
      } catch (err) {
        setError('Failed to load velocity');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchVelocity();
  }, []);

  if (loading) {
    return (
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Loading velocity...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mb-4">
        <CardContent className="p-4">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!velocity) {
    return null;
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Velocity</CardTitle>
        <CardDescription>Story points tracking</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {velocity.total_estimated}
            </div>
            <div className="text-sm text-muted-foreground">Total Estimated</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {velocity.completed}
            </div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {velocity.remaining}
            </div>
            <div className="text-sm text-muted-foreground">Remaining</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

