import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    const dateParams = `start_date=${formatDate(startDate)}&end_date=${formatDate(endDate)}`;

    const [dailyVolume, cumulativeVolume, genesisData, volumeUSD] = await Promise.all([
      fetch(`https://charts.e.cash/api/charts/daily-agora-volume?${dateParams}`).then(res => res.json()),
      fetch(`https://charts.e.cash/api/charts/cumulative-agora-volume?${dateParams}`).then(res => res.json()),
      fetch(`https://charts.e.cash/api/charts/daily-genesis-txs?${dateParams}`).then(res => res.json()),
      fetch(`https://charts.e.cash/api/charts/daily-agora-volume-usd?${dateParams}`).then(res => res.json())
    ]);

    return NextResponse.json({
      dailyVolume,
      cumulativeVolume,
      genesisData,
      volumeUSD
    });
  } catch (error) {
    console.error('Failed to fetch Agora stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Agora stats' },
      { status: 500 }
    );
  }
}

