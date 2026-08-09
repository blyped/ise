import { AdminListSkeleton } from './_components/AdminSkeletons';

/** Etat de chargement par defaut de toutes les routes /administration (D-93). */
export default function AdministrationLoading() {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-7 py-8 max-md:px-4 max-md:py-5">
      <AdminListSkeleton />
    </div>
  );
}
