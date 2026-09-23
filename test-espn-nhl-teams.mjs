const url =
  "https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/2026/players?view=kona_player_info";

const headers = {
  "User-Agent": "Mozilla/5.0",
  "Accept": "application/json",
  "X-Fantasy-Filter": JSON.stringify({
    filterActive: {
      value: true
    }
  })
};

async function main() {
  const response = await fetch(url, { headers });

  console.log("STATUS:", response.status);

  if (!response.ok) {
    throw new Error(`ESPN HTTP ${response.status}`);
  }

  const players = await response.json();

  console.log("PLAYERS:", players.length);

  const teams = new Map();

  for (const player of players) {
    const teamId = Number(player.proTeamId ?? 0);

    if (!teams.has(teamId)) {
      teams.set(teamId, {
        count: 0,
        samples: []
      });
    }

    const team = teams.get(teamId);
    team.count++;

    if (team.samples.length < 3) {
      team.samples.push(player.fullName);
    }
  }

  const rows = [...teams.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([proTeamId, value]) => ({
      proTeamId,
      count: value.count,
      samples: value.samples.join(" | ")
    }));

  console.table(rows);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
