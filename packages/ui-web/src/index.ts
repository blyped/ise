/**
 * @ise/ui-web — bibliotheque de composants Web de Competences ISE.
 *
 * Regles transverses :
 *  - tous les composants exposent leurs etats (default / hover / focus-visible /
 *    active / disabled / loading / error) ;
 *  - aucune couleur dediee par module metier, et la couleur ne porte jamais
 *    seule une information (D-90) ;
 *  - contraste WCAG 2.2 AA, focus toujours visible, tout est utilisable au clavier ;
 *  - aucune dependance a Next.js.
 */
export { cx, type ClassValue } from './utils/cx';

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './components/Button';
export { IconButton, type IconButtonProps } from './components/IconButton';
export { Spinner, type SpinnerProps } from './components/Spinner';

export { Field, type FieldProps, type FieldRenderProps } from './components/Field';
export { Input, type InputProps, INPUT_BASE } from './components/Input';
export { Textarea, type TextareaProps } from './components/Textarea';
export { Select, type SelectProps, type SelectOption } from './components/Select';
export { Checkbox, type CheckboxProps } from './components/Checkbox';
export { Radio, type RadioProps } from './components/Radio';
export { RadioGroup, type RadioGroupProps } from './components/RadioGroup';
export { Switch, type SwitchProps } from './components/Switch';

export { Card, CardHeader, CardTitle, CardDescription, type CardProps } from './components/Card';
export { Badge, type BadgeProps, type BadgeTone } from './components/Badge';
export { Chip, type ChipProps } from './components/Chip';
export { Avatar, initialsOf, type AvatarProps, type AvatarSize } from './components/Avatar';
export {
  PHOTO_CROP_DEFAULT,
  PHOTO_CROP_FOCAL_MIN,
  PHOTO_CROP_FOCAL_MAX,
  PHOTO_CROP_ZOOM_MIN,
  PHOTO_CROP_ZOOM_MAX,
  PHOTO_CROP_FRAME_STYLE,
  photoCropWrapperStyle,
  isCustomPhotoCrop,
  type PhotoCrop,
  type PhotoCropShape,
} from './utils/photo-crop';
export { Skeleton, type SkeletonProps } from './components/Skeleton';

export { Alert, type AlertProps, type AlertVariant } from './components/Alert';
export { EmptyState, type EmptyStateProps } from './components/EmptyState';
export { ErrorState, type ErrorStateProps } from './components/ErrorState';
export { Modal, type ModalProps } from './components/Modal';
export {
  ToastProvider,
  ToastAlert,
  useToast,
  type ToastMessage,
  type ToastTone,
} from './components/Toast';
export { Tabs, type TabsProps, type TabItem } from './components/Tabs';

/**
 * Primitives de formulaire ajoutees avec l'onboarding (ISE-008 -> ISE-014)
 * et le profil membre (ISE-016 -> ISE-023). Elles vivent sous `src/form/`
 * et ne modifient aucun composant existant.
 */
export { StepProgress, type StepProgressProps } from './form/StepProgress';
export {
  VisibilitySelect,
  type VisibilitySelectProps,
  type VisibilityLevelValue,
} from './form/VisibilitySelect';
export {
  TokenPicker,
  type TokenPickerProps,
  type TokenPickerLabels,
  type TokenOption,
} from './form/TokenPicker';
export {
  OptionCardGroup,
  type OptionCardGroupProps,
  type OptionCardItem,
} from './form/OptionCardGroup';

export {
  AlertIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  ErrorIcon,
  EyeIcon,
  EyeOffIcon,
  InboxIcon,
  InfoIcon,
} from './components/icons';
