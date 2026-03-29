import { Text, type TextStyle } from "react-native";

interface Props {
  children: string;
  size?: number;
  style?: Omit<TextStyle, "fontFamily">;
}

// Renders emojis using the system font.
// IMPORTANT: fontFamily must be completely absent from the style object —
// setting it to undefined/null still causes React Native to apply custom fonts
// (Fredoka/Inter) which don't have emoji glyphs, showing "?" boxes.
export default function EmojiText({ children, size = 20, style }: Props) {
  return (
    <Text style={[{ fontSize: size, lineHeight: size * 1.25 }, style]}>
      {children}
    </Text>
  );
}
