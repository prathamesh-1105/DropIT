import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const revalidate = 0; // Disable static caching for health ping

export async function GET() {
  try {
    // Keep-alive database query to prevent Supabase auto-pause
    const { count, error } = await supabase
      .from('rooms')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.warn('Health check DB warning:', error.message);
    }

    return NextResponse.json(
      {
        status: 'online',
        uptime: '24/7',
        timestamp: new Date().toISOString(),
        database: error ? 'warning' : 'connected',
        roomCount: count || 0,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', message: err.message },
      { status: 500 }
    );
  }
}
