import Svg, { Path, Rect } from 'react-native-svg';

type IconProps = {
  size?: number;
  color?: string;
};

/** Bank building: pediment, four columns, base. Used for "View products". */
export function BankIcon({ size = 22, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2.5 2.5 7.5v1.8h19V7.5L12 2.5Z" fill={color} />
      <Rect x="4.2" y="10.6" width="2.4" height="7.4" rx="0.6" fill={color} />
      <Rect x="8.7" y="10.6" width="2.4" height="7.4" rx="0.6" fill={color} />
      <Rect x="12.9" y="10.6" width="2.4" height="7.4" rx="0.6" fill={color} />
      <Rect x="17.4" y="10.6" width="2.4" height="7.4" rx="0.6" fill={color} />
      <Rect x="2.5" y="19.2" width="19" height="2.3" rx="0.6" fill={color} />
    </Svg>
  );
}

/** House outline. Used for "Back to Sensor". */
export function HomeIcon({ size = 22, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 10.6 12 3.5l8.5 7.1V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1v-9.4Z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Chevron pointing left. Used for the in-site "previous page" button. */
export function ChevronLeftIcon({ size = 22, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 8 12l7 7" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Arrow pointing right, drawn after a button label. */
export function ArrowRightIcon({ size = 20, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h13M13 6l6 6-6 6" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Padlock shown in the address bar for secure (https) pages. */
export function LockIcon({ size = 14, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4.5" y="10.5" width="15" height="10.5" rx="2.2" fill={color} />
      <Path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}
