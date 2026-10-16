import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { mediaUrl } from '../../api/client';
import { colors, radius } from '../../theme';

/** Browsers cannot add headers to <img>, so fetch with the token and show a blob URL. */
export function AuthMedia({ id, kind, token }: { id: number; kind: 'image' | 'video'; token: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    fetch(mediaUrl(id), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (!b || cancelled) return;
        revoked = URL.createObjectURL(b);
        setUrl(revoked);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [id, token]);
  if (!url) return <View style={{ height: 120, borderRadius: radius.md, backgroundColor: colors.border }} />;
  return kind === 'video' ? (
    <video src={url} controls playsInline style={{ width: '100%', borderRadius: radius.md }} />
  ) : (
    <img src={url} alt="" style={{ width: '100%', borderRadius: radius.md, objectFit: 'cover' }} />
  );
}

