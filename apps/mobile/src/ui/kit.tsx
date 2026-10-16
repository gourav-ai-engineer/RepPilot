import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, radius, space, TOUCH } from '../theme';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
          <View style={styles.maxWidth}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.screenContent, styles.maxWidth, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'primary' | 'warn' | 'danger' }) {
  const bg = tone === 'primary' ? colors.primarySoft : tone === 'warn' ? colors.warnSoft : tone === 'danger' ? colors.dangerSoft : colors.card;
  return <View style={[styles.card, { backgroundColor: bg }, style]}>{children}</View>;
}

export function H1({ children }: { children: ReactNode }) {
  return <Text style={styles.h1} accessibilityRole="header">{children}</Text>;
}
export function H2({ children }: { children: ReactNode }) {
  return <Text style={styles.h2} accessibilityRole="header">{children}</Text>;
}
export function H3({ children }: { children: ReactNode }) {
  return <Text style={styles.h3}>{children}</Text>;
}
export function Body({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}
export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  icon,
  compact,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  icon?: string;
  compact?: boolean;
}) {
  const bg = kind === 'primary' ? colors.primary : kind === 'danger' ? colors.danger : kind === 'secondary' ? colors.primarySoft : 'transparent';
  const fg = kind === 'primary' || kind === 'danger' ? '#fff' : colors.primaryDark;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        kind === 'ghost' && { borderWidth: 1, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.buttonText, { color: fg }, compact && { fontSize: font.small }]}>
        {icon ? `${icon}  ` : ''}
        {label}
      </Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {selected ? '✓ ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Input(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: space.xs }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput placeholderTextColor={colors.muted} style={[styles.input, style]} {...rest} />
    </View>
  );
}

export function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <View style={styles.barTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max, now: value }}>
      <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 99, format }: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  format?: (v: number) => string;
}) {
  return (
    <Row style={{ alignItems: 'center', gap: space.sm }}>
      <Button compact kind="secondary" label="−" onPress={() => onChange(Math.max(min, +(value - step).toFixed(2)))} />
      <Text style={[styles.body, { minWidth: 56, textAlign: 'center', fontWeight: '600' }]}>{format ? format(value) : value}</Text>
      <Button compact kind="secondary" label="+" onPress={() => onChange(Math.min(max, +(value + step).toFixed(2)))} />
    </Row>
  );
}

export function SafetyNote({ text }: { text: string }) {
  return (
    <View style={styles.safety} accessibilityRole="alert">
      <Text style={styles.safetyText}>⚠️  {text}</Text>
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.sm }} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: space.lg, paddingBottom: space.xl * 2 },
  maxWidth: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: space.md },
  card: {
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  h1: { fontSize: font.h1, fontWeight: '700', color: colors.text },
  h2: { fontSize: font.h2, fontWeight: '700', color: colors.text },
  h3: { fontSize: font.h3, fontWeight: '600', color: colors.text },
  body: { fontSize: font.body, color: colors.text, lineHeight: 24 },
  muted: { fontSize: font.small, color: colors.muted, lineHeight: 21 },
  label: { fontSize: font.small, color: colors.text, fontWeight: '600' },
  button: {
    minHeight: TOUCH,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: { minHeight: 40, minWidth: 44, paddingHorizontal: space.md },
  buttonText: { fontSize: font.body, fontWeight: '700' },
  chip: {
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: font.small, color: colors.text },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  input: {
    minHeight: TOUCH,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: font.body,
    backgroundColor: colors.card,
    color: colors.text,
  },
  barTrack: { height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden', flex: 1 },
  barFill: { height: '100%', borderRadius: 5 },
  safety: { backgroundColor: colors.warnSoft, borderRadius: radius.md, padding: space.md },
  safetyText: { fontSize: font.small, color: colors.text, lineHeight: 21 },
});
