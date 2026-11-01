// Small inline SVG icons (Chakra v3 ships none). All are decorative: aria-hidden.
function Svg({ size = '1em', children, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const HomeIcon = (props) => (
  <Svg {...props}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M10 21v-6h4v6" />
  </Svg>
)

export const BookIcon = (props) => (
  <Svg {...props}>
    <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" />
    <path d="M4 19a2 2 0 0 1 2-2h13" />
  </Svg>
)

export const ChevronRightIcon = (props) => (
  <Svg {...props}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
)

export const ChevronDownIcon = (props) => (
  <Svg {...props}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
)

export const CheckIcon = (props) => (
  <Svg {...props}>
    <path d="m5 12 5 5L20 7" />
  </Svg>
)

export const LogoutIcon = (props) => (
  <Svg {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </Svg>
)

export const WarningIcon = (props) => (
  <Svg {...props}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </Svg>
)

export const HourglassIcon = (props) => (
  <Svg {...props}>
    <path d="M6 2h12" />
    <path d="M6 22h12" />
    <path d="M7 2v4a5 5 0 0 0 2 4l3 2-3 2a5 5 0 0 0-2 4v4" />
    <path d="M17 2v4a5 5 0 0 1-2 4l-3 2 3 2a5 5 0 0 1 2 4v4" />
  </Svg>
)

export const MoreIcon = (props) => (
  <Svg {...props} fill="currentColor" stroke="none">
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </Svg>
)

export const MenuIcon = (props) => (
  <Svg {...props}>
    <path d="M4 6h16" />
    <path d="M4 12h16" />
    <path d="M4 18h16" />
  </Svg>
)
