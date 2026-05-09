import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface PreviewModeBannerProps {
  className?: string;
}

const PreviewModeBanner = ({ className }: PreviewModeBannerProps) => {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'flex min-h-[40px] w-full items-center justify-center bg-sky-100 px-4 py-2 text-center text-sm font-medium leading-5 text-sky-800',
        className,
      )}
    >
      <span>{t('module.preview.previewLinkNotice')}</span>
    </div>
  );
};

export default memo(PreviewModeBanner);
