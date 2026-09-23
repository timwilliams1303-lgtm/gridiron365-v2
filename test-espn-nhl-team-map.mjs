const url =
  "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams?limit=100";

async function main() {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json"
    }
  });

  console.log("STATUS:", response.status);

  if (!response.ok) {
    throw new Error(`ESPN HTTP ${response.status}`);
  }

  const data = await response.json();

  const teams =
    data?.sports?.[0]?.leagues?.[0]?.teams ?? [];

  const rows = teams
    .map((row) => row.team)
    .map((team) => ({
      id: Number(team.id),
      abbreviation: team.abbreviation,
      name: team.displayName
    }))
    .sort((a, b) => a.id - b.id);

  console.log("TEAMS:", rows.length);
  console.table(rows);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
