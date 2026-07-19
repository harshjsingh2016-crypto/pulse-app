import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signOut } from 'firebase/auth';
import RightSheet from './RightSheet';
import { Colors, Typography, Spacing, Radius } from '../lib/tokens';
import { useAuth } from '../hooks/useAuth';
import { auth } from '../lib/firebase';
import { deleteAccountFn } from '../lib/functions';

export default function AccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleDelete = async () => {
    setDeleting(true);
    setErrorMsg('');
    try {
      await deleteAccountFn({});
      // Close the sheet and reset before signing out — otherwise the modal (and its
      // spinner) stays mounted over the login screen after the redirect.
      setDeleting(false);
      setConfirming(false);
      onClose();
      await signOut(auth); // auth user is gone; clears state and redirects to login
    } catch (e) {
      setErrorMsg('Could not delete account. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <RightSheet visible={visible} onClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Account</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.ruledLine} />

        <View style={styles.body}>
          {user?.displayName ? (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Name</Text>
              <Text style={styles.fieldValue}>{user.displayName}</Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.fieldValue}>{user?.email ?? '—'}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>User ID</Text>
            <Text style={[styles.fieldValue, styles.uid]} numberOfLines={1}>{user?.uid ?? '—'}</Text>
          </View>

          <View style={styles.dangerZone}>
            {!confirming ? (
              <TouchableOpacity onPress={() => setConfirming(true)}>
                <Text style={styles.deleteLink}>Delete account</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmText}>
                  This permanently deletes your account and all your data — tasks, meals, spending,
                  chats, everything. This can't be undone.
                </Text>
                <View style={styles.confirmBtns}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => { setConfirming(false); setErrorMsg(''); }}
                    disabled={deleting}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={deleting}>
                    {deleting ? (
                      <ActivityIndicator color={Colors.paper} size="small" />
                    ) : (
                      <Text style={styles.deleteBtnText}>Delete everything</Text>
                    )}
                  </TouchableOpacity>
                </View>
                {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    </RightSheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.base, paddingBottom: Spacing.md,
  },
  back: {
    fontFamily: Typography.bodyMedium, fontSize: Typography.size.base, color: Colors.accent,
  },
  title: {
    fontFamily: Typography.display, fontSize: Typography.size.xl, color: Colors.ink, letterSpacing: -0.3,
  },
  headerSpacer: { width: 60 },
  ruledLine: { height: 1, backgroundColor: Colors.ruledLine, marginHorizontal: Spacing.xl },
  body: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl },
  field: {
    borderBottomWidth: 1, borderBottomColor: Colors.ruledLine, paddingBottom: Spacing.md, marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textFaint,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.xs,
  },
  fieldValue: {
    fontFamily: Typography.body, fontSize: Typography.size.base, color: Colors.ink,
  },
  uid: {
    fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textMid,
  },
  dangerZone: { marginTop: Spacing.xl },
  deleteLink: {
    fontFamily: Typography.bodyMedium, fontSize: Typography.size.base, color: Colors.vermilion,
  },
  confirmBox: {
    borderWidth: 1, borderColor: Colors.vermilion, borderRadius: Radius.md,
    padding: Spacing.base, gap: Spacing.md, backgroundColor: Colors.paperWarm,
  },
  confirmText: {
    fontFamily: Typography.body, fontSize: Typography.size.sm, color: Colors.textBody,
    lineHeight: Typography.size.sm * Typography.lineHeight.relaxed,
  },
  confirmBtns: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  cancelText: { fontFamily: Typography.bodyMedium, fontSize: Typography.size.sm, color: Colors.textMid },
  deleteBtn: {
    flex: 1, backgroundColor: Colors.vermilion, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  deleteBtnText: { fontFamily: Typography.bodySemiBold, fontSize: Typography.size.sm, color: Colors.paper },
  errorText: {
    fontFamily: Typography.body, fontSize: Typography.size.sm, color: Colors.vermilion, textAlign: 'center',
  },
});
