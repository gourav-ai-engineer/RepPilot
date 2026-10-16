import { Image, Text, View } from 'react-native';
import { mediaUrl } from '../../api/client';
import { S } from '../../i18n';
import { colors, radius } from '../../theme';

/** Shows a private photo using the login token (native supports request headers). */
export function AuthMedia({ id, kind, token }: { id: number; kind: 'image' | 'video'; token: string }) {
  if (kind === 'video') {
    return (
      <View style={{ padding: 16, borderRadius: radius.md, backgroundColor: colors.border }}>
        <Text>🎬 {S.community.video}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: mediaUrl(id), headers: { Authorization: `Bearer ${token}` } }}
      style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: colors.border }}
      resizeMode="cover"
      accessibilityLabel="Photo"
    />
  );
}
