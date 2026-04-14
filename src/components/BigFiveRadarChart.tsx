import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';

interface OceanScores {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

export function BigFiveRadarChart({ scores }: { scores: OceanScores }) {
  const data = [
    { trait: 'Ouverture', value: scores.openness, fullMark: 100 },
    { trait: 'Conscienciosité', value: scores.conscientiousness, fullMark: 100 },
    { trait: 'Extraversion', value: scores.extraversion, fullMark: 100 },
    { trait: 'Agréabilité', value: scores.agreeableness, fullMark: 100 },
    { trait: 'Névrosisme', value: scores.neuroticism, fullMark: 100 },
  ];

  return (
    <ResponsiveContainer width="100%" height={250}>
      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis dataKey="trait" tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
        <Radar
          name="OCEAN"
          dataKey="value"
          stroke="hsl(var(--primary))"
          fill="hsl(var(--primary))"
          fillOpacity={0.25}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
