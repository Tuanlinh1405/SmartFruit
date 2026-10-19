import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lotsRepository, lotPrivateRepository } from './lot.api';
import type { Lot, LotInput, LotListFilters, LotPrivateInput, LotsRepository, LotPrivateRepository, LotStatus } from './lot.model';

export const lotKeys = {
  all: (userId: string | null) => ['farmer-lots', userId] as const,
  list: (userId: string | null, filters: LotListFilters) => ['farmer-lots', userId, 'list', filters] as const,
  detail: (userId: string | null, id: string) => ['farmer-lots', userId, 'detail', id] as const,
  private: (userId: string | null, id: string) => ['farmer-lots', userId, 'private', id] as const,
};
// authenticatedUserId must be passed by B's resolved session, not route/form input.
export function useLotCatalog(userId: string | null, repository: LotsRepository = lotsRepository) {
  return useQuery({ queryKey: ['lot-catalog', userId], enabled: !!userId, queryFn: () => repository.catalog(userId!), retry: false });
}
export function useLotResources(userId: string | null, repository: LotsRepository = lotsRepository) {
  return {
    catalog: useLotCatalog(userId, repository),
    profile: useQuery({ queryKey: ['lot-farmer-profile', userId], enabled: !!userId, queryFn: () => repository.hasFarmerProfile(userId!), retry: false }),
  };
}
export function useLotList(userId: string | null, filters: LotListFilters, repository: LotsRepository = lotsRepository) {
  return useQuery({ queryKey: lotKeys.list(userId, filters), enabled: !!userId, queryFn: () => repository.list(userId!, filters), retry: false });
}
export function useLotDetail(userId: string | null, id: string, repository: LotsRepository = lotsRepository) {
  return useQuery({ queryKey: lotKeys.detail(userId, id), enabled: !!userId && !!id, queryFn: () => repository.detail(userId!, id), retry: false });
}
export function useLotPrivate(userId: string | null, id: string, repository: LotPrivateRepository = lotPrivateRepository) {
  return useQuery({ queryKey: lotKeys.private(userId, id), enabled: !!userId && !!id, queryFn: () => repository.load(userId!, id), retry: false });
}
export type LotCommand =
  | { kind: 'create'; input: LotInput; draftId: string }
  | { kind: 'update'; id: string; input: LotInput }
  | { kind: 'status'; id: string; status: LotStatus }
  | { kind: 'delete'; id: string };
export function useLotActions(userId: string | null, repository: LotsRepository = lotsRepository) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (command: LotCommand): Promise<Lot | null> => {
      if (!userId) throw new Error('Vui lòng đăng nhập.');
      if (command.kind === 'create') return repository.createDraft(userId, command.input, command.draftId);
      if (command.kind === 'update') return repository.update(userId, command.id, command.input);
      if (command.kind === 'status') return repository.changeStatus(userId, command.id, command.status);
      await repository.remove(userId, command.id); return null;
    },
    onSuccess: (lot, command) => {
      if (lot) client.setQueryData(lotKeys.detail(userId, lot.id), lot);
      if (command.kind === 'delete') {
        client.removeQueries({ queryKey: lotKeys.detail(userId, command.id) });
        client.removeQueries({ queryKey: lotKeys.private(userId, command.id) });
      }
      void client.invalidateQueries({ queryKey: [...lotKeys.all(userId), 'list'] });
    },
  });
}
export function useSaveLotPrivate(userId: string | null, id: string, repository: LotPrivateRepository = lotPrivateRepository) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: LotPrivateInput) => {
    if (!userId) throw new Error('Vui lòng đăng nhập.');
    return repository.save(userId, id, input);
  }, onSuccess: data => { client.setQueryData(lotKeys.private(userId, id), data); } });
}
