// this script loads all merged PRs within the given page range
// it can be used to update the CHANGELOG.md file in a semi-automated way
// the problem: codeberg doesn't support loading merged PRs, so we have to filter them in memory
// luckily, we can sort after "recentupdate", which means we can do incremental changelog generation
// todo: support setting a "last_updated" date, so the script would automatically check how far it has to go

async function main() {
  let pageStart = 1;
  let pageEnd = 1;
  let prs = [];
  for (let p = pageStart; p <= pageEnd; p++) {
    console.log(`load page ${p}/${pageEnd}`);
    const res = await fetch(
      `https://codeberg.org/api/v1/repos/uzu/strudel/pulls?state=closed&sort=recentupdate&page=${p}`,
    );
    const pulls = await res.json();
    const merged = pulls.filter((pull) => pull.merged);
    prs = prs.concat(merged);
  }
  const output = prs
    .sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at))
    .map(
      (pull) => `- ${pull.closed_at} ${pull.title} by @${pull.user.login || '?'} in: [#${pull.number}](${pull.url}) `,
    )
    .join('\n');
  console.log('-------------');
  console.log(output);
}

main();
