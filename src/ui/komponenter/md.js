/* Komponentene fra Miljødirektoratets designsystem som siden bruker. De hentes hver for seg fra pakken, så bare disse kommer med i
   bygget. Pakkens samlede inngang tar med alle komponentene. */
export { MdAlertMessage } from '@miljodirektoratet/md-react/dist/messages/MdAlertMessage';
export { MdButton } from '@miljodirektoratet/md-react/dist/button/MdButton';
export { MdCheckbox } from '@miljodirektoratet/md-react/dist/formElements/MdCheckbox';
export { MdIconButton } from '@miljodirektoratet/md-react/dist/iconButton/MdIconButton';
export { MdLink } from '@miljodirektoratet/md-react/dist/link/MdLink';
export { MdLoadingSpinner } from '@miljodirektoratet/md-react/dist/loadingSpinner/MdLoadingSpinner';
export { MdRadioGroup } from '@miljodirektoratet/md-react/dist/formElements/MdRadioGroup';
export { MdSelect } from '@miljodirektoratet/md-react/dist/formElements/MdSelect';
export { MdToggle } from '@miljodirektoratet/md-react/dist/toggle/MdToggle';
import * as kombo from '@miljodirektoratet/md-react/dist/formElements/MdComboBox';
/* MdComboBox finnes bare som standardeksport i CommonJS. Avhengig av byggeverktøyet kommer den som selve komponenten eller pakket inn
   i et objekt med default. */
export const MdComboBox = kombo.default && kombo.default.default ? kombo.default.default : kombo.default;
export { MdIconClose } from '@miljodirektoratet/md-react/dist/icons-material/MdIconClose';
export { MdIconDelete } from '@miljodirektoratet/md-react/dist/icons-material/MdIconDelete';
export { MdIconEdit } from '@miljodirektoratet/md-react/dist/icons-material/MdIconEdit';
export { MdIconLocation } from '@miljodirektoratet/md-react/dist/icons-material/MdIconLocation';
export { MdIconOpenInNew } from '@miljodirektoratet/md-react/dist/icons-material/MdIconOpenInNew';
export { MdIconUpload } from '@miljodirektoratet/md-react/dist/icons-material/MdIconUpload';
