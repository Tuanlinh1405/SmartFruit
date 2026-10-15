import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../../components/shared';
import { FarmerProfileForm } from './farmer-profile-form';
import { useFarmerProfile } from './use-farmer-profile';
import type { FarmerProfileRepository } from './farmer-profile.model';

// Integration point for B: mount only after Auth/role resolution with FARMER access.
// Deliberately not registered in the production router before Auth is delivered.
export function FarmerProfilePanel({ authenticatedUserId, repository }: {
  authenticatedUserId: string | null;
  repository?: FarmerProfileRepository;
}) {
  // Remount the form/mutation on identity changes; never retain another user's input.
  return <ProfileForUser key={authenticatedUserId ?? 'signed-out'} userId={authenticatedUserId} repository={repository} />;
}

function ProfileForUser({ userId, repository }: { userId: string | null; repository?: FarmerProfileRepository }) {
  const { profile, save } = useFarmerProfile(userId, repository);
  if (!userId) return <EmptyState title="Chưa đăng nhập" description="Vui lòng đăng nhập để quản lý hồ sơ nhà vườn." />;
  if (profile.isPending) return <LoadingState />;
  if (profile.isError) return <ErrorState message="Không thể tải hồ sơ nhà vườn." onRetry={() => { void profile.refetch(); }} />;
  return <div className="stack">
    <PageHeader title="Hồ sơ nhà vườn" description="Quản lý thông tin vườn của bạn." />
    {!profile.data && <EmptyState title="Chưa có hồ sơ nhà vườn" description="Điền thông tin bên dưới để tạo hồ sơ trước khi đăng lô hàng." />}
    <FarmerProfileForm initialProfile={profile.data} onSave={input => save.mutateAsync(input)} />
  </div>;
}
