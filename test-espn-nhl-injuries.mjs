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
    console.log(await response.text());
    process.exit(1);
  }

  const players = await response.json();

  console.log("PLAYERS:", players.length);

  const counts = {};

  for (const player of players) {
    const status = player.injuryStatus || "[BLANK]";
    counts[status] = (counts[status] || 0) + 1;
  }

  console.table(counts);

  console.log("\nINJURED / NON-ACTIVE PLAYERS:");

  console.table(
    players
      .filter(
        (player) =>
          player.injured === true ||
          (player.injuryStatus &&
            player.injuryStatus !== "ACTIVE")
      )
      .map((player) => ({
        id: player.id,
        name: player.fullName,
        proTeamId: player.proTeamId,
        positionId: player.defaultPositionId,
        injuryStatus: player.injuryStatus,
        injured: player.injured
      }))
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
