# Poker Home Game Tracker

A full-stack poker game tracking application built with Next.js, Supabase, and Clerk authentication.

## Features

- 🎮 **Group Management**: Create and join poker groups with invite codes
- 🎲 **Game Tracking**: Track buy-ins, end amounts, and calculate profits
- 📊 **Statistics & Charts**: View running totals, cumulative charts, and player statistics
- 🏆 **Leaderboards**: See rankings by group or individual performance
- 👥 **Multi-User Support**: Multiple players can join games and track their sessions

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Clerk
- **UI Components**: shadcn/ui
- **Charts**: Recharts
- **Styling**: Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase account ([supabase.com](https://supabase.com))
- A Clerk account ([clerk.com](https://clerk.com))

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd poker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   
   # Clerk
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
   CLERK_SECRET_KEY=your-clerk-secret-key
   ```

4. **Set up Supabase database**
   
   See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for detailed instructions.
   
   Quick steps:
   - Create a Supabase project
   - Run the SQL schema from `supabase/schema.sql` in the Supabase SQL Editor
   - Copy your project URL and anon key to `.env`

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
poker/
├── src/
│   ├── app/                 # Next.js app router pages
│   │   ├── games/          # Game pages
│   │   ├── groups/         # Group pages
│   │   ├── leaderboard/    # Leaderboard page
│   │   └── statistics/     # Statistics page
│   ├── components/         # React components
│   │   ├── ui/            # shadcn/ui components
│   │   ├── GameForm.tsx
│   │   ├── GroupForm.tsx
│   │   ├── Leaderboard.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── supabase/      # Supabase client utilities
│   │   └── utils.ts       # Utility functions
│   └── types/             # TypeScript type definitions
├── supabase/
│   └── schema.sql         # Database schema
└── .env                  # Environment variables (not in git)
```

## Key Features

### Groups
- Create poker groups with custom names and descriptions
- Generate unique invite codes for easy sharing
- Track group members and their roles

### Games
- Host creates a game (no players required initially)
- Group members can join games and add their buy-in/end amounts
- Track game status (open, in-progress, completed)

### Statistics
- View overall statistics across all games
- Filter by group or individual performance
- Running totals charts (by date and cumulative)
- Player leaderboards

## Database Schema

The application uses the following main tables:
- `users` - Links Clerk user IDs
- `groups` - Poker groups
- `group_members` - User-group relationships
- `games` - Individual poker games
- `game_sessions` - Player participation in games

See `supabase/schema.sql` for the complete schema.

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Adding New Features

1. Update database schema if needed (add migration to `supabase/`)
2. Update TypeScript types in `src/types/`
3. Add/update storage functions in `src/lib/supabase/storage.ts`
4. Create or update components
5. Update pages to use new functionality

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Environment Variables for Production

Make sure to set all environment variables in your hosting platform:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

## Documentation

- [Supabase Setup Guide](./SUPABASE_SETUP.md) - Detailed Supabase configuration
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Clerk Documentation](https://clerk.com/docs)

## License

MIT
