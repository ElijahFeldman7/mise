type Props = { size?: number; className?: string };

function Svg({ size = 20, className, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const CalendarIcon = (p: Props) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18" />
  </Svg>
);

export const BookIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M5 20V5a2 2 0 0 1 2-2h12v18H7a2 2 0 0 0-2 2z" />
    <path d="M9 8h7M9 12h5" />
  </Svg>
);

export const ListIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M4 7l1.6 1.6L9 5.2M4 14l1.6 1.6L9 12.2" />
    <path d="M12 7h8M12 14h8M12 20h8M4 20h4" />
  </Svg>
);

export const HouseIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
    <path d="M9.5 20v-5h5v5" />
  </Svg>
);

export const PersonIcon = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
  </Svg>
);

export const ShieldIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
  </Svg>
);

export const CameraIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M3 8.5h3.2L8 6h8l1.8 2.5H21V20H3z" />
    <circle cx="12" cy="14" r="3.6" />
  </Svg>
);

export const PlateIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M4 15h16a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" />
    <path d="M6 12a6 6 0 0 1 12 0" />
    <path d="M12 6V4" />
  </Svg>
);

export const ReceiptIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z" />
    <path d="M9 8h6M9 12h6" />
  </Svg>
);

export const ChevronLeft = (p: Props) => (
  <Svg {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
);

export const ChevronRight = (p: Props) => (
  <Svg {...p}>
    <path d="M9 5l7 7-7 7" />
  </Svg>
);

export const PlusIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const CheckIcon = ({ size = 12, className }: Props) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <path d="M4.5 12.5l4.5 4.5L19.5 6.5" />
  </svg>
);

export const SearchIcon = (p: Props) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-4.2-4.2" />
  </Svg>
);

export const TrashIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" />
  </Svg>
);

export const PencilIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
  </Svg>
);
