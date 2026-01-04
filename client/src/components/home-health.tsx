import { PieChart, Pie, Cell, ResponsiveContainer, Label } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface HomeHealthProps {
  score: number;
}

export function HomeHealth({ score }: HomeHealthProps) {
  const data = [
    { name: 'Score', value: score },
    { name: 'Remaining', value: 100 - score },
  ];

  // Determine color based on score
  let color = "hsl(var(--primary))";
  if (score < 60) color = "hsl(var(--destructive))";
  else if (score < 80) color = "#f59e0b"; // Amber/Orange
  else color = "hsl(150, 60%, 45%)"; // Green

  return (
    <Card className="h-full border-none shadow-sm bg-gradient-to-br from-card to-secondary/20">
      <CardHeader>
        <CardTitle className="text-lg font-heading">Home Health Score</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="none"
              >
                <Cell key="score" fill={color} />
                <Cell key="remaining" fill="hsl(var(--muted))" />
                <Label
                  value={score}
                  position="center"
                  className="fill-foreground text-4xl font-bold font-heading"
                />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 mt-8 text-sm text-muted-foreground font-medium">
            / 100
          </div>
        </div>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Your home is in <span className="font-semibold text-foreground">Good Condition</span>, but needs attention on <span className="font-semibold text-foreground">Roofing</span>.
        </p>
      </CardContent>
    </Card>
  );
}
