export type SkillLevel = "beginner" | "intermediate" | "advanced";

export type MatchStatus =
  | "pending_court"
  | "open"
  | "full"
  | "confirmed"
  | "completed"
  | "cancelled_unfilled"
  | "cancelled_by_organizer";

export type MatchPlayerStatus =
  | "pending_payment"
  | "paid"
  | "cancelled"
  | "cancelled_late"
  | "no_show";

export interface Profile {
  id: string;
  fullName: string;
  phone: string;
  whatsappPhone?: string | null;
  skillLevel: SkillLevel;
  role: "player" | "organizer";
  strikeCount: number;
  avatarUrl?: string | null;
  wantsMatchNotifications: boolean;
  createdAt: string;
}

export interface MatchMessage {
  id: string;
  matchId: string;
  playerId: string;
  playerName: string;
  playerAvatar?: string | null;
  content: string;
  createdAt: string;
}

export interface MatchResult {
  id: string;
  matchId: string;
  set1Team1: number;
  set1Team2: number;
  set2Team1: number;
  set2Team2: number;
  set3Team1?: number | null;
  set3Team2?: number | null;
  winnerTeam: 1 | 2;
  recordedBy: string;
  createdAt: string;
}

export interface Match {
  id: string;
  hostPlayerId: string;
  venueId?: string | null;
  venueName: string;
  scheduledAt: string;
  joinDeadline: string;
  skillLevel: SkillLevel;
  maxPlayers: number;
  orgFeeCop: number;
  durationMinutes: 60 | 90 | 120;
  status: MatchStatus;
  notes?: string | null;
  cancelReason?: string | null;
  courtReference?: string | null;
  createdAt: string;
}

/** Match enriched with joined-player preview data for the list view */
export interface MatchPreview extends Match {
  paidCount: number;
  playerNames: string[];
  playerAvatars: (string | null)[]; // avatar URLs aligned with playerNames
}

export interface MatchPlayer {
  id: string;
  matchId: string;
  /** Null when the slot belongs to a non-registered guest. */
  playerId: string | null;
  isHost: boolean;
  status: MatchPlayerStatus;
  joinedAt: string;
  // Guest slots (non-registered invitees). See docs/specs/jugadores-invitados.md
  guestName?: string | null;
  guestPhone?: string | null;
  /** Registered player who invited and pays for this guest. */
  invitedByPlayerId?: string | null;
  /** Set when a guest claims this slot by registering with the same phone. */
  claimedAt?: string | null;
}

/** Groups one or more match-player slots paid in a single Wompi transaction. */
export interface PaymentIntent {
  id: string;
  matchId: string;
  paidByPlayerId: string;
  amountCop: number;
  currency: "COP";
  provider: "wompi";
  status: "pending" | "approved" | "declined" | "voided" | "refunded";
  wompiReference?: string | null;
  wompiTransactionId?: string | null;
  paymentMethod?: string | null;
  idempotencyKey: string;
  createdAt: string;
  approvedAt?: string | null;
}

export interface Payment {
  id: string;
  matchPlayerId: string;
  matchId: string;
  /** Null when the funded slot belongs to a guest (no profile). */
  playerId: string | null;
  /** Parent intent grouping this allocation (null for legacy individual rows). */
  paymentIntentId?: string | null;
  amountCop: number;
  currency: "COP";
  provider: "wompi";
  status: "pending" | "approved" | "declined" | "voided" | "refunded";
  paymentMethod?: string | null;
  externalReference?: string | null;
  wompiTransactionId?: string | null;
  idempotencyKey: string;
  createdAt: string;
  approvedAt?: string | null;
}

export interface AnalyticsEvent {
  eventName: string;
  userId?: string;
  matchId?: string;
  properties?: Record<string, unknown>;
}

export interface PlayerMatchHistoryItem {
  matchId: string;
  venueName: string;
  scheduledAt: string;
  skillLevel: SkillLevel;
  status: MatchStatus;
  playerStatus: MatchPlayerStatus;
  joinedAt: string;
  orgFeeCop: number;
}

export interface PublicPlayerProfile {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  skillLevel: SkillLevel;
  whatsappPhone?: string | null;
  memberSince: string;
  matchesPlayed: number;
  upcomingMatches: number;
}

export interface CommunityPlayerCard {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  skillLevel: SkillLevel;
  lastSeenAt: string;
}
