/**
 * Demo mode fixtures (CINEPHILE_DEMO=1).
 *
 * Lets anyone preview the UI - including the 3D cupboard - without wiring
 * up GitHub or TMDB credentials. Watch actions succeed against an
 * in-memory library; no commits are made anywhere.
 */
import type { HomeFeedData, TmdbDetail, TmdbSearchResult, TmdbSeason } from './tmdb.js';
import type { WatchedEntry } from './types.js';

interface DemoItem {
  id: number;
  type: 'movie' | 'tv';
  title: string;
  year: number;
  overview: string;
  runtime: number;
  genres: string[];
  seasons?: Array<{ season_number: number; name: string; episode_count: number; air_date: string | null }>;
}

const DEMO_ITEMS: DemoItem[] = [
  {
    id: 27205, type: 'movie', title: 'Inception', year: 2010, runtime: 148,
    overview: 'A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.',
    genres: ['Action', 'Science Fiction', 'Thriller'],
  },
  {
    id: 603, type: 'movie', title: 'The Matrix', year: 1999, runtime: 136,
    overview: 'Set in the 22nd century, The Matrix tells the story of a computer hacker who joins a group of underground insurgents fighting the vast and powerful computers who now rule the earth.',
    genres: ['Action', 'Science Fiction'],
  },
  {
    id: 155, type: 'movie', title: 'The Dark Knight', year: 2008, runtime: 152,
    overview: 'Batman raises the stakes in his war on crime, but when a criminal mastermind known as the Joker appears, Gotham is plunged into anarchy.',
    genres: ['Action', 'Crime', 'Thriller', 'Drama'],
  },
  {
    id: 157336, type: 'movie', title: 'Interstellar', year: 2014, runtime: 169,
    overview: 'The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel and conquer the vast distances involved in an interstellar voyage.',
    genres: ['Adventure', 'Drama', 'Science Fiction'],
  },
  {
    id: 550, type: 'movie', title: 'Fight Club', year: 1999, runtime: 139,
    overview: 'A ticking-time-bomb insomniac and a slippery soap salesman channel primal male aggression into a shocking new form of therapy.',
    genres: ['Drama', 'Thriller', 'Comedy'],
  },
  {
    id: 680, type: 'movie', title: 'Pulp Fiction', year: 1994, runtime: 154,
    overview: 'A burger-loving hit man, his philosophical partner, a drug-addled gangster\'s moll and a washed-up boxer converge in three stories of violence and redemption.',
    genres: ['Crime', 'Thriller'],
  },
  {
    id: 13, type: 'movie', title: 'Forrest Gump', year: 1994, runtime: 142,
    overview: 'A man with a low IQ has accomplished great things in his life and been present during significant historic events—in each case, far exceeding what anyone imagined he could do.',
    genres: ['Comedy', 'Drama', 'Romance'],
  },
  {
    id: 496243, type: 'movie', title: 'Parasite', year: 2019, runtime: 133,
    overview: 'All unemployed, Ki-taek\'s family takes peculiar interest in the wealthy Parks for their livelihood until they get entangled in an unexpected incident.',
    genres: ['Comedy', 'Thriller', 'Drama'],
  },
  {
    id: 129, type: 'movie', title: 'Spirited Away', year: 2001, runtime: 125,
    overview: 'A young girl wanders into a world ruled by gods, magic, and spirits where humans are changed into beasts.',
    genres: ['Animation', 'Family', 'Fantasy'],
  },
  {
    id: 244786, type: 'movie', title: 'Whiplash', year: 2014, runtime: 107,
    overview: 'Under the direction of a ruthless instructor, a talented young drummer begins to pursue perfection at any cost, even his humanity.',
    genres: ['Drama', 'Music'],
  },
  {
    id: 120467, type: 'movie', title: 'The Grand Budapest Hotel', year: 2014, runtime: 99,
    overview: 'The adventures of Gustave H, a legendary concierge at a famous European hotel, and Zero Moustafa, the lobby boy who becomes his most trusted friend.',
    genres: ['Comedy', 'Drama'],
  },
  {
    id: 76341, type: 'movie', title: 'Mad Max: Fury Road', year: 2015, runtime: 121,
    overview: 'An apocalyptic story set in the furthest reaches of our planet, in a stark desert landscape where humanity is broken, and most everyone is crazed fighting for the necessities of life.',
    genres: ['Action', 'Adventure', 'Science Fiction'],
  },
  {
    id: 329865, type: 'movie', title: 'Arrival', year: 2016, runtime: 116,
    overview: 'Taking place after alien crafts land around the world, an expert linguist is recruited by the military to determine whether they come in peace or are a threat.',
    genres: ['Science Fiction', 'Drama', 'Mystery'],
  },
  {
    id: 335984, type: 'movie', title: 'Blade Runner 2049', year: 2017, runtime: 164,
    overview: 'Thirty years after the events of the first film, a new blade runner, LAPD Officer K, unearths a long-buried secret that has the potential to plunge what\'s left of society into chaos.',
    genres: ['Action', 'Science Fiction', 'Drama'],
  },
  {
    id: 354912, type: 'movie', title: 'Coco', year: 2017, runtime: 105,
    overview: 'Despite his family\'s baffling generations-old ban on music, Miguel dreams of becoming an accomplished musician like his idol, Ernesto de la Cruz.',
    genres: ['Animation', 'Family', 'Music'],
  },
  {
    id: 2062, type: 'movie', title: 'Ratatouille', year: 2007, runtime: 111,
    overview: 'Remy, a resident of Paris, appreciates good food and has quite a sophisticated palate. He would love to become a chef so he can create and enjoy culinary masterpieces.',
    genres: ['Animation', 'Comedy', 'Family'],
  },
  {
    id: 10681, type: 'movie', title: 'WALL·E', year: 2008, runtime: 98,
    overview: 'WALL·E is the last robot left on an Earth that has been overrun with garbage and all humans have fled to outer space.',
    genres: ['Animation', 'Family', 'Science Fiction'],
  },
  {
    id: 1124, type: 'movie', title: 'The Prestige', year: 2006, runtime: 130,
    overview: 'A mysterious story of two magicians whose intense rivalry leads them on a life-long battle for supremacy.',
    genres: ['Drama', 'Mystery', 'Thriller'],
  },
  {
    id: 807, type: 'movie', title: 'Se7en', year: 1995, runtime: 127,
    overview: 'Two detectives, a rookie and a veteran, hunt a serial killer who uses the seven deadly sins as his motives.',
    genres: ['Crime', 'Mystery', 'Thriller'],
  },
  {
    id: 694, type: 'movie', title: 'The Shining', year: 1980, runtime: 146,
    overview: 'Jack Torrance accepts a caretaker job at the Overlook Hotel, where he, along with his wife Wendy and their son Danny, must live isolated from the rest of the world for the winter.',
    genres: ['Horror', 'Thriller'],
  },
  {
    id: 278, type: 'movie', title: 'The Shawshank Redemption', year: 1994, runtime: 142,
    overview: 'Framed in the 1940s for double murder, upstanding banker Andy Dufresne begins a new life at Shawshank prison and quickly finds himself protected by the guards.',
    genres: ['Drama', 'Crime'],
  },
  {
    id: 238, type: 'movie', title: 'The Godfather', year: 1972, runtime: 175,
    overview: 'Spanning the years 1945 to 1955, a chronicle of the fictional Italian-American Corleone crime family.',
    genres: ['Drama', 'Crime'],
  },
  {
    id: 497, type: 'movie', title: 'The Green Mile', year: 1999, runtime: 189,
    overview: 'A supernatural tale set on death row in a Southern prison, where gentle giant John Coffey possesses the mysterious power to heal people\'s ailments.',
    genres: ['Crime', 'Fantasy', 'Drama'],
  },
  {
    id: 539, type: 'movie', title: 'Psycho', year: 1960, runtime: 109,
    overview: 'When larcenous real estate clerk Marion Crane goes on the lam with a wad of cash and hopes of starting a new life, she ends up at the notorious Bates Motel.',
    genres: ['Horror', 'Thriller'],
  },
  {
    id: 122, type: 'movie', title: 'The Lord of the Rings: The Return of the King', year: 2003, runtime: 201,
    overview: 'Aragorn is revealed as the heir to the ancient kings as he makes his way to Minas Tirith for the final battles.',
    genres: ['Adventure', 'Fantasy', 'Action'],
  },
  {
    id: 11, type: 'movie', title: 'Star Wars', year: 1977, runtime: 121,
    overview: 'Princess Leia is captured and held hostage by the evil Imperial forces in their effort to quell the rebellion against the Galactic Empire.',
    genres: ['Adventure', 'Action', 'Science Fiction'],
  },
  {
    id: 438631, type: 'movie', title: 'Dune', year: 2021, runtime: 155,
    overview: 'Paul Atreides, a brilliant and gifted young man born into a great destiny beyond his understanding, must travel to the most dangerous planet in the universe.',
    genres: ['Science Fiction', 'Adventure'],
  },
  {
    id: 361743, type: 'movie', title: 'Top Gun: Maverick', year: 2022, runtime: 130,
    overview: 'After thirty years, Maverick is still pushing the envelope as a top naval aviator, but must confront ghosts of his past.',
    genres: ['Action', 'Drama'],
  },
  {
    id: 1396, type: 'tv', title: 'Breaking Bad', year: 2008, runtime: 45,
    overview: 'When Walter White, a New Mexico chemistry teacher, is diagnosed with Stage III cancer and given a prognosis of only two years left to live, he begins running a side business cooking meth.',
    genres: ['Drama', 'Crime'],
    seasons: [
      { season_number: 1, name: 'Season 1', episode_count: 7, air_date: '2008-01-20' },
      { season_number: 2, name: 'Season 2', episode_count: 13, air_date: '2009-03-08' },
      { season_number: 3, name: 'Season 3', episode_count: 13, air_date: '2010-03-21' },
      { season_number: 4, name: 'Season 4', episode_count: 13, air_date: '2011-07-17' },
      { season_number: 5, name: 'Season 5', episode_count: 16, air_date: '2012-07-15' },
    ],
  },
  {
    id: 1399, type: 'tv', title: 'Game of Thrones', year: 2011, runtime: 55,
    overview: 'Seven noble families fight for control of the mythical land of Westeros.',
    genres: ['Sci-Fi & Fantasy', 'Drama', 'Action & Adventure'],
    seasons: [
      { season_number: 1, name: 'Season 1', episode_count: 10, air_date: '2011-04-17' },
      { season_number: 2, name: 'Season 2', episode_count: 10, air_date: '2012-04-01' },
    ],
  },
  {
    id: 60059, type: 'tv', title: 'Better Call Saul', year: 2015, runtime: 46,
    overview: 'Six years before Saul Goodman meets Walter White, he is known as Jimmy McGill, a small-time lawyer searching for his destiny.',
    genres: ['Drama', 'Crime'],
    seasons: [
      { season_number: 1, name: 'Season 1', episode_count: 10, air_date: '2015-02-08' },
    ],
  },
  {
    id: 456, type: 'tv', title: 'Stranger Things', year: 2016, runtime: 50,
    overview: 'When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces, and one strange little girl.',
    genres: ['Drama', 'Mystery', 'Sci-Fi & Fantasy'],
    seasons: [
      { season_number: 1, name: 'Season 1', episode_count: 8, air_date: '2016-07-15' },
    ],
  },
  {
    id: 87108, type: 'tv', title: 'Chernobyl', year: 2019, runtime: 65,
    overview: 'The true story of one of the worst man-made catastrophes in history: the catastrophic nuclear accident at Chernobyl.',
    genres: ['Drama'],
    seasons: [
      { season_number: 1, name: 'Limited Series', episode_count: 5, air_date: '2019-05-06' },
    ],
  },
  {
    id: 1668, type: 'tv', title: 'Friends', year: 1994, runtime: 25,
    overview: 'The misadventures of a group of friends as they navigate the pitfalls of work, life and love in Manhattan.',
    genres: ['Comedy', 'Drama'],
    seasons: [
      { season_number: 1, name: 'Season 1', episode_count: 24, air_date: '1994-09-22' },
    ],
  },
];

const DEMO_EPISODE_TITLES: Record<string, string[]> = {
  '1396:1': ['Pilot', "Cat's in the Bag...", "...And the Bag's in the River", 'Cancer Man', 'Gray Matter', 'Crazy Handful of Nothin\'', "A No-Rough-Stuff-Type Deal"],
  '1396:2': ['Seven Thirty-Seven', 'Grilled', 'Bit by a Dead Bee', 'Down', 'Breakage', 'Peekaboo', 'Negro y Azul', 'Fine', 'Mandala', 'Over', 'Mandala', 'Phoenix', 'ABQ'],
  '1399:1': ['Winter Is Coming', 'The Kingsroad', 'Lord Snow', 'Cripples, Bastards, and Broken Things', 'The Wolf and the Lion', 'A Golden Crown', 'You Win or You Die', 'The Pointy End', 'Baelor', 'Fire and Blood'],
  '60059:1': ['Uno', 'Mijo', 'Nacho', 'Hero', 'Alpine Shepherd Boy', 'Five-O', 'Bingo', 'RICO', 'Pimento', 'Marco'],
  '456:1': ['Chapter One: The Vanishing of Will Byers', 'Chapter Two: The Weirdo on Maple Street', 'Chapter Three: Holly, Jolly', 'Chapter Four: The Body', 'Chapter Five: The Flea and the Acrobat', 'Chapter Six: The Monster', 'Chapter Seven: The Bathtub', 'Chapter Eight: The Upside Down'],
  '87108:1': ['1:23:45', 'Please Remain Calm', 'Open Wide, O Earth', 'The Happiness of All Mankind', 'Vichnaya Pamyat'],
  '1668:1': ['The One Where Monica Gets a Roommate', 'The One with the Sonogram at the End', 'The One with the Thumb', 'The One with George Stephanopoulos', 'The One with the East German Laundry Detergent', 'The One with the Butt', 'The One with the Blackout', 'The One Where Nana Dies Twice', 'The One Where Underdog Gets Away', 'The One with the Monkey', 'The One with Mrs. Bing', 'The One with the Dozen Lasagnas', 'The One with the Boobies', 'The One with the Candy Hearts', 'The One with the Stoned Guy', 'The One with Two Parts, Part 1', 'The One with Two Parts, Part 2', 'The One with All the Poker', 'The One Where the Monkey Gets Away', 'The One with the Evil Orthodontist', 'The One with Fake Monica', 'The One with the Ick Factor', 'The One with the Birth', 'The One Where Rachel Finds Out'],
};

function demoDetail(item: DemoItem): TmdbDetail {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    year: item.year,
    overview: item.overview,
    poster_path: null, // demo covers are generated locally as gradient sleeves
    backdrop_path: null,
    runtime_minutes: item.runtime,
    genres: item.genres,
    seasons: (item.seasons ?? []).map((s) => ({
      season_number: s.season_number,
      name: s.name,
      episode_count: s.episode_count,
      air_date: s.air_date,
      poster_path: null,
    })),
    status: item.type === 'tv' ? 'Returning Series' : 'Released',
  };
}

/** In-memory demo library, pre-seeded so the cupboard has something to show. */
const demoLibrary: WatchedEntry[] = [
  { tmdb_id: 27205, type: 'movie', title: 'Inception', year: 2010, watched_at: daysAgo(45), rating: 9, poster_path: null },
  { tmdb_id: 603, type: 'movie', title: 'The Matrix', year: 1999, watched_at: daysAgo(44), rating: 10, poster_path: null },
  { tmdb_id: 155, type: 'movie', title: 'The Dark Knight', year: 2008, watched_at: daysAgo(43), rating: 10, poster_path: null },
  { tmdb_id: 157336, type: 'movie', title: 'Interstellar', year: 2014, watched_at: daysAgo(41), rating: 9, poster_path: null },
  { tmdb_id: 550, type: 'movie', title: 'Fight Club', year: 1999, watched_at: daysAgo(40), rating: 9, poster_path: null },
  { tmdb_id: 680, type: 'movie', title: 'Pulp Fiction', year: 1994, watched_at: daysAgo(39), rating: 10, poster_path: null },
  { tmdb_id: 13, type: 'movie', title: 'Forrest Gump', year: 1994, watched_at: daysAgo(37), rating: 9, poster_path: null },
  { tmdb_id: 496243, type: 'movie', title: 'Parasite', year: 2019, watched_at: daysAgo(36), rating: 10, poster_path: null },
  { tmdb_id: 129, type: 'movie', title: 'Spirited Away', year: 2001, watched_at: daysAgo(35), rating: 10, poster_path: null },
  { tmdb_id: 244786, type: 'movie', title: 'Whiplash', year: 2014, watched_at: daysAgo(33), rating: 9, poster_path: null },
  { tmdb_id: 120467, type: 'movie', title: 'The Grand Budapest Hotel', year: 2014, watched_at: daysAgo(32), rating: 8, poster_path: null },
  { tmdb_id: 76341, type: 'movie', title: 'Mad Max: Fury Road', year: 2015, watched_at: daysAgo(30), rating: 8, poster_path: null },
  { tmdb_id: 329865, type: 'movie', title: 'Arrival', year: 2016, watched_at: daysAgo(29), rating: 9, poster_path: null },
  { tmdb_id: 335984, type: 'movie', title: 'Blade Runner 2049', year: 2017, watched_at: daysAgo(27), rating: 9, poster_path: null },
  { tmdb_id: 354912, type: 'movie', title: 'Coco', year: 2017, watched_at: daysAgo(26), rating: 9, poster_path: null },
  { tmdb_id: 2062, type: 'movie', title: 'Ratatouille', year: 2007, watched_at: daysAgo(25), rating: 8, poster_path: null },
  { tmdb_id: 10681, type: 'movie', title: 'WALL·E', year: 2008, watched_at: daysAgo(23), rating: 9, poster_path: null },
  { tmdb_id: 1124, type: 'movie', title: 'The Prestige', year: 2006, watched_at: daysAgo(22), rating: 9, poster_path: null },
  { tmdb_id: 807, type: 'movie', title: 'Se7en', year: 1995, watched_at: daysAgo(20), rating: 9, poster_path: null },
  { tmdb_id: 694, type: 'movie', title: 'The Shining', year: 1980, watched_at: daysAgo(19), rating: 9, poster_path: null },
  { tmdb_id: 278, type: 'movie', title: 'The Shawshank Redemption', year: 1994, watched_at: daysAgo(18), rating: 10, poster_path: null },
  { tmdb_id: 238, type: 'movie', title: 'The Godfather', year: 1972, watched_at: daysAgo(16), rating: 10, poster_path: null },
  { tmdb_id: 497, type: 'movie', title: 'The Green Mile', year: 1999, watched_at: daysAgo(15), rating: 9, poster_path: null },
  { tmdb_id: 539, type: 'movie', title: 'Psycho', year: 1960, watched_at: daysAgo(13), rating: 9, poster_path: null },
  { tmdb_id: 122, type: 'movie', title: 'The Lord of the Rings: The Return of the King', year: 2003, watched_at: daysAgo(12), rating: 10, poster_path: null },
  { tmdb_id: 11, type: 'movie', title: 'Star Wars', year: 1977, watched_at: daysAgo(10), rating: 10, poster_path: null },
  { tmdb_id: 438631, type: 'movie', title: 'Dune', year: 2021, watched_at: daysAgo(9), rating: 8, poster_path: null },
  { tmdb_id: 361743, type: 'movie', title: 'Top Gun: Maverick', year: 2022, watched_at: daysAgo(8), rating: 8, poster_path: null },
  // TV: each episode is its own entry/commit, a few recent binges.
  ...breakingBadEntries(),
  ...chernobylEntries(),
  { tmdb_id: 456, type: 'tv', title: 'Stranger Things', year: 2016, watched_at: daysAgo(3), rating: 8, poster_path: null, season: 1, episode: 1, episode_title: 'Chapter One: The Vanishing of Will Byers' },
];

function breakingBadEntries(): WatchedEntry[] {
  const titles = DEMO_EPISODE_TITLES['1396:1'];
  return titles.map((t, i) => ({
    tmdb_id: 1396, type: 'tv' as const, title: 'Breaking Bad', year: 2008,
    watched_at: daysAgo(6), rating: 10, poster_path: null,
    season: 1, episode: i + 1, episode_title: t,
  }));
}

function chernobylEntries(): WatchedEntry[] {
  const titles = DEMO_EPISODE_TITLES['87108:1'];
  return titles.map((t, i) => ({
    tmdb_id: 87108, type: 'tv' as const, title: 'Chernobyl', year: 2019,
    watched_at: daysAgo(5), rating: 10, poster_path: null,
    season: 1, episode: i + 1, episode_title: t,
  }));
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(20, 0, 0, 0);
  return d.toISOString();
}

export function demoSearch(query: string): TmdbSearchResult[] {
  const q = query.trim().toLowerCase();
  const items = q
    ? DEMO_ITEMS.filter((i) => i.title.toLowerCase().includes(q))
    : DEMO_ITEMS;
  return items.map((i) => ({
    id: i.id,
    media_type: i.type,
    title: i.title,
    year: i.year,
    poster_path: null,
    backdrop_path: null,
    overview: i.overview,
  }));
}

export function demoHome(): HomeFeedData {
  const toResult = (i: DemoItem): TmdbSearchResult => ({
    id: i.id,
    media_type: i.type,
    title: i.title,
    year: i.year,
    poster_path: null,
    backdrop_path: null,
    overview: i.overview,
  });
  const movies = DEMO_ITEMS.filter((i) => i.type === 'movie');
  const shows = DEMO_ITEMS.filter((i) => i.type === 'tv');
  return {
    hero: movies.slice(0, 6).map(toResult),
    rows: [
      { id: 'demo-movies', title: 'Demo Movies', items: movies.map(toResult) },
      { id: 'demo-series', title: 'Demo Series', items: shows.map(toResult) },
      {
        id: 'demo-top',
        title: 'Demo Essentials',
        items: movies.slice().reverse().map(toResult),
      },
    ],
  };
}

export function demoMovieDetail(id: number): TmdbDetail | null {
  const item = DEMO_ITEMS.find((i) => i.id === id && i.type === 'movie');
  return item ? demoDetail(item) : null;
}

export function demoTvDetail(id: number): TmdbDetail | null {
  const item = DEMO_ITEMS.find((i) => i.id === id && i.type === 'tv');
  return item ? demoDetail(item) : null;
}

export function demoSeasonDetail(id: number, seasonNumber: number): TmdbSeason | null {
  const item = DEMO_ITEMS.find((i) => i.id === id && i.type === 'tv');
  if (!item) return null;
  const season = item.seasons?.find((s) => s.season_number === seasonNumber);
  if (!season) return null;
  const titles = DEMO_EPISODE_TITLES[`${id}:${seasonNumber}`] ?? [];
  return {
    season_number: seasonNumber,
    name: season.name,
    episode_count: season.episode_count,
    air_date: season.air_date,
    overview: '',
    episodes: Array.from({ length: season.episode_count }, (_, i) => ({
      episode_number: i + 1,
      season_number: seasonNumber,
      name: titles[i] ?? `Episode ${i + 1}`,
      air_date: season.air_date,
      overview: '',
      still_path: null,
    })),
  };
}

export function demoLibraryEntries(): WatchedEntry[] {
  return [...demoLibrary];
}

export function demoAppendEntry(entry: WatchedEntry): void {
  demoLibrary.push(entry);
}

export function demoFakeSha(): string {
  const hex = '0123456789abcdef';
  let sha = '';
  for (let i = 0; i < 40; i++) sha += hex[Math.floor(Math.random() * 16)];
  return sha;
}
