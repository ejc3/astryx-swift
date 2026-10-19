/**
 * The inbox's sample conversations, copied from Astryx's `table-inbox` template (same values, same order).
 */

export type Priority = 'urgent' | 'high' | 'normal';

/** Where a thread stands, which is also which tab it appears under. 'inbox' as a tab shows everything. */
export type Category = 'inbox' | 'escalations' | 'waiting' | 'resolved';

export type Attachment = {
  id: string;
  name: string;
  src: string;
};

/** One message in a thread. The stored `replies` are all earlier messages; the newest is the conversation's own. */
export type ThreadMessage = {
  id: string;
  sender: string;
  senderEmail: string;
  receivedFull: string;
  body: string[];
  attachments?: Attachment[];
};

export type Conversation = {
  id: string;
  sender: string;
  senderEmail: string;
  subject: string;
  preview: string;
  tags: string[];
  /** Short form for the row; the pane shows `receivedFull`. */
  receivedAt: string;
  receivedFull: string;
  isUnread: boolean;
  priority: Priority;
  category: Category;
  assignee: string | null;
  body: string[];
  attachments: Attachment[];
  /** Earlier messages, oldest first. */
  replies?: ThreadMessage[];
};

/** The placeholder image every sample attachment uses. */
export const PLACEHOLDER_SRC =
  'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20400%20300%22%20preserveAspectRatio%3D%22xMidYMid%20slice%22%3E%3Crect%20width%3D%22400%22%20height%3D%22300%22%20fill%3D%22%23f5f6f8%22%2F%3E%3Cg%20transform%3D%22translate%28200%20150%29%22%20fill%3D%22none%22%20stroke%3D%22%23c2cad6%22%20stroke-width%3D%225%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%22-44%22%20y%3D%22-44%22%20width%3D%2288%22%20height%3D%2288%22%20rx%3D%2216%22%2F%3E%3Ccircle%20cx%3D%2218%22%20cy%3D%22-18%22%20r%3D%222.5%22%20fill%3D%22%23c2cad6%22%20stroke%3D%22none%22%2F%3E%3Cpath%20d%3D%22M-34%2030%20L-8%200%20L10%2018%20L20%208%20L34%2024%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E';

export const CONVERSATIONS: Conversation[] = [
  {
    id: 'c-01',
    category: 'escalations',
    sender: 'Priya Raman',
    senderEmail: 'priya.raman@northwind.example',
    subject: 'Checkout returns 502 for EU customers',
    preview:
      'Started around 09:40 UTC. Roughly one in five card payments fails at the confirm step…',
    tags: ['Billing', 'Escalated'],
    receivedAt: '9:52 AM',
    receivedFull: 'Today at 9:52 AM',
    isUnread: true,
    priority: 'urgent',
    assignee: null,
    body: [
      'Started around 09:40 UTC. Roughly one in five card payments fails at the confirm step, and only for customers billing to an EU address — US and APAC look untouched.',
      'The response is a bare 502 with no body, so our retry logic treats it as transient and re-submits. Two customers have now been charged twice.',
      'I have paused the retry worker as a stopgap, so the double charges should stop, but the underlying failures have not.',
    ],
    attachments: [
      {
        id: 'c-01-a1',
        name: 'northwind-checkout-eu.png',
        src: PLACEHOLDER_SRC,
      },
    ],
    replies: [
      {
        id: 'c-01-r1',
        sender: 'Priya Raman',
        senderEmail: 'priya.raman@northwind.example',
        receivedFull: 'Today at 9:44 AM',
        body: [
          'Flagging early — our payments dashboard has just lit up. No numbers yet, but the failures all look like they are on the confirm step rather than the authorisation.',
        ],
      },
      {
        id: 'c-01-r2',
        sender: 'Lucas Meyer',
        // Support-side. Every address on the team shares this domain, which is
        // how a header says "this one is us" without a badge saying so.
        senderEmail: 'lucas.meyer@support.example',
        receivedFull: 'Today at 9:47 AM',
        body: [
          'Acknowledged, paging the payments on-call. Nothing on our status page, so if this is regional it is sitting under our alerting threshold.',
          'Is it specific to one card network, or all of them?',
        ],
      },
    ],
  },
  {
    id: 'c-02',
    category: 'inbox',
    sender: 'Marcus Feld',
    senderEmail: 'm.feld@harbourpoint.example',
    subject: 'SSO metadata rotation — need new certificate',
    preview:
      'Our IdP certificate expires Friday. Can you confirm the fingerprint before we cut over?',
    tags: ['Identity'],
    receivedAt: '9:31 AM',
    receivedFull: 'Today at 9:31 AM',
    isUnread: true,
    priority: 'high',
    assignee: null,
    body: [
      'Our IdP certificate expires Friday at 23:59 UTC. We have the replacement staged and can publish new metadata whenever you are ready.',
      'Before we cut over, can you confirm the SHA-256 fingerprint you have on file matches the one we published? Last rotation we mismatched and locked out 400 people for an hour.',
    ],
    attachments: [],
  },
  {
    id: 'c-03',
    category: 'resolved',
    sender: 'Dana Osei',
    senderEmail: 'dana@osei-consulting.example',
    subject: 'Re: Bulk export finished but the file is empty',
    preview:
      'Thanks — re-running with the date filter cleared did produce rows this time.',
    tags: ['Exports'],
    receivedAt: '8:58 AM',
    receivedFull: 'Today at 8:58 AM',
    isUnread: true,
    priority: 'normal',
    assignee: 'You',
    body: [
      'Thanks — re-running with the date filter cleared did produce rows this time, so it looks like the filter was the culprit rather than the export itself.',
      'Worth noting the empty file still came back with a 200 and a success banner, which is what sent me down the wrong path. A warning when an export matches zero records would have saved a morning.',
    ],
    attachments: [],
    replies: [
      {
        id: 'c-03-r1',
        sender: 'Dana Osei',
        senderEmail: 'dana@osei-consulting.example',
        receivedFull: 'Yesterday at 5:12 PM',
        body: [
          'Ran the full-account export this afternoon. It finished in about forty seconds and handed me a zero-byte CSV — no header row, nothing.',
        ],
      },
      {
        id: 'c-03-r2',
        sender: 'Marta Nowak',
        senderEmail: 'marta.nowak@support.example',
        receivedFull: 'Today at 8:31 AM',
        body: [
          'A zero-byte file usually means the query matched no rows rather than that the export itself failed. Could you retry with the date filter cleared and tell me whether the file comes back with content?',
        ],
      },
    ],
  },
  {
    id: 'c-04',
    category: 'inbox',
    sender: 'Tomás Ibarra',
    senderEmail: 'tomas.ibarra@meridian.example',
    subject: 'Webhook retries stopped after the 3rd attempt',
    preview:
      'We expected five retries with backoff. Logs show three and then nothing for order 88214.',
    tags: ['Webhooks', 'Bug'],
    receivedAt: '8:14 AM',
    receivedFull: 'Today at 8:14 AM',
    isUnread: false,
    priority: 'high',
    assignee: 'You',
    body: [
      'We expected five retries with exponential backoff. Logs show three attempts and then nothing for order 88214.',
      'The endpoint was returning 503 throughout, so this should have kept retrying to the documented limit. The gap in our delivery log after 08:02 is the part I cannot explain.',
    ],
    attachments: [],
  },
  {
    id: 'c-05',
    category: 'waiting',
    sender: 'Hannah Lindqvist',
    senderEmail: 'h.lindqvist@varda.example',
    subject: 'Homepage refresh — three directions for your review',
    preview:
      'Attached the three we shortlisted. We need a decision by Thursday to hold the schedule.',
    tags: ['Design', 'Review'],
    receivedAt: 'Yesterday',
    receivedFull: 'Yesterday at 4:22 PM',
    isUnread: false,
    priority: 'high',
    assignee: null,
    body: [
      'Attached the three directions we shortlisted out of the eleven we explored. They differ in mood rather than structure, so the layout work carries over whichever one you pick.',
      'Colourful is the boldest and the furthest from the current site. Light is the safest and reads closest to the product itself. Moody photographs best but needs art direction we do not have in-house yet.',
      'We need a decision by Thursday to hold the build schedule.',
    ],
    attachments: [
      {
        id: 'a-1',
        name: 'direction-1-colourful.png',
        src: PLACEHOLDER_SRC,
      },
      {
        id: 'a-2',
        name: 'direction-2-light.png',
        src: PLACEHOLDER_SRC,
      },
      {
        id: 'a-3',
        name: 'direction-3-moody.png',
        src: PLACEHOLDER_SRC,
      },
    ],
    replies: [
      {
        id: 'c-05-r1',
        sender: 'Hannah Lindqvist',
        senderEmail: 'h.lindqvist@varda.example',
        receivedFull: 'Monday at 3:05 PM',
        body: [
          'Kicking off the homepage refresh. We have eleven explorations open; I will cut them to three before Thursday so you get something decidable rather than a mood board.',
        ],
      },
      {
        id: 'c-05-r2',
        sender: 'Elliot Nakamura',
        senderEmail: 'elliot.nakamura@support.example',
        receivedFull: 'Tuesday at 10:18 AM',
        body: [
          'Three is the right number. One request: hold the hero structure identical across all of them, so the thing we are judging is treatment and not layout. Last round nobody could tell which of the two they were reacting to.',
        ],
      },
      {
        // A second voice from the customer's side, and the only one in the
        // fixture. Every other thread is one customer and one agent, where
        // Reply and Reply all address the same person and the difference
        // between the two buttons never shows.
        id: 'c-05-r2b',
        sender: 'Ines Duarte',
        senderEmail: 'i.duarte@varda.example',
        receivedFull: 'Tuesday at 4:52 PM',
        body: [
          'Copy is written against the current hero, so holding the structure suits us — I will only need to reflow if the headline slot changes length.',
        ],
      },
      {
        id: 'c-05-r3',
        sender: 'Hannah Lindqvist',
        senderEmail: 'h.lindqvist@varda.example',
        receivedFull: 'Yesterday at 11:40 AM',
        body: [
          'Structure is fixed across all three. Sending the moody direction on its own first — it is the one most likely to split the room, and it reads differently without the other two beside it.',
        ],
        attachments: [
          {
            id: 'c-05-r3-a1',
            name: 'moody-direction-hero.png',
            src: PLACEHOLDER_SRC,
          },
        ],
      },
    ],
  },
  {
    id: 'c-06',
    category: 'waiting',
    sender: 'Owen Baptiste',
    senderEmail: 'obaptiste@fieldstone.example',
    subject: 'Seat count says 145 but we only provisioned 120',
    preview:
      'Finance flagged the discrepancy on the March invoice. Can we reconcile before the 30th?',
    tags: ['Billing'],
    receivedAt: 'Yesterday',
    receivedFull: 'Yesterday at 11:07 AM',
    isUnread: false,
    priority: 'high',
    assignee: 'You',
    body: [
      'Finance flagged the discrepancy on the March invoice. Our directory shows 120 provisioned seats; the invoice bills 145.',
      'My guess is deactivated accounts are still counted until the end of the billing period, but I cannot find that stated anywhere. Can we reconcile before the 30th?',
    ],
    attachments: [],
  },
  {
    id: 'c-07',
    category: 'inbox',
    sender: 'Aiko Tanaka',
    senderEmail: 'aiko.tanaka@shorebird.example',
    subject: 'Docs: the rate-limit page contradicts the API response header',
    preview:
      'Page says 600/min, header reports 300/min on our plan. One of them is wrong.',
    tags: ['Docs'],
    receivedAt: 'Yesterday',
    receivedFull: 'Yesterday at 9:15 AM',
    isUnread: false,
    priority: 'normal',
    assignee: null,
    body: [
      'The rate-limit page says 600 requests per minute on Scale. The X-RateLimit-Limit header on our responses reports 300.',
      'One of them is wrong, and we have sized a batch job against the larger number.',
    ],
    attachments: [],
  },
  {
    id: 'c-08',
    category: 'resolved',
    sender: 'Reuben Cole',
    senderEmail: 'r.cole@atlasgrid.example',
    subject: 'Re: Scheduled maintenance window confirmation',
    preview: 'Confirmed for Sunday 02:00–04:00 UTC. Nothing further needed.',
    tags: ['Ops'],
    receivedAt: 'Mon',
    receivedFull: 'Monday at 2:40 PM',
    isUnread: false,
    priority: 'normal',
    assignee: 'You',
    body: [
      'Confirmed for Sunday 02:00–04:00 UTC. We have notified our on-call and paused the nightly sync for that window.',
      'Nothing further needed from your side.',
    ],
    attachments: [],
  },
  {
    id: 'c-09',
    category: 'inbox',
    sender: 'Sofia Marchetti',
    senderEmail: 'sofia@marchetti-legal.example',
    subject: 'Feature request: per-workspace retention policy',
    preview:
      'Our legal team needs 30-day retention on one workspace and 400 on another.',
    tags: ['Feature request'],
    receivedAt: 'Mon',
    receivedFull: 'Monday at 10:02 AM',
    isUnread: false,
    priority: 'normal',
    assignee: null,
    body: [
      'Our legal team needs 30-day retention on the client-intake workspace and 400 days on the matter-archive workspace.',
      'Today retention is an account-level setting, so we are stuck applying the longer policy everywhere, which is the opposite of what our counsel wants.',
    ],
    attachments: [],
  },
];

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'escalations', label: 'Escalations' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'resolved', label: 'Resolved' },
];
