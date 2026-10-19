import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { farmerProfileRepository } from './farmer-profile.api';
import type { FarmerProfileInput, FarmerProfileRepository } from './farmer-profile.model';

export const farmerProfileKey = (userId: string | null) => ['farmer-profile', userId] as const;

// userId must come from B's resolved Auth session, never a route/form/role selector.
export function useFarmerProfile(userId: string | null, repository: FarmerProfileRepository = farmerProfileRepository) {
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: farmerProfileKey(userId), enabled: !!userId,
    queryFn: () => repository.load(userId!), retry: false,
  });
  const save = useMutation({
    mutationFn: (input: FarmerProfileInput) => {
      if (!userId) throw new Error('Vui lòng đăng nhập trước khi lưu hồ sơ.');
      return repository.save(userId, input);
    },
    onSuccess: data => {
      queryClient.setQueryData(farmerProfileKey(userId), data);
      queryClient.setQueryData(['lot-farmer-profile', userId], true);
    },
  });
  return { profile, save };
}
