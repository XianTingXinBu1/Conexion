/**
 * 角色卡导入 / 导出模块
 */

export {
  parseCharacterImport,
  serializeCharacterCard,
  serializeCharacterBackup,
  toCharacterCardData,
  fromCharacterCardData,
  toSafeFileName,
  CharacterCardParseError,
  BACKUP_SPEC,
  ST_CARD_SPEC,
  ST_CARD_SPEC_VERSION,
} from './cardCodec';

export type { CharacterCardData, ImportedCharacter } from './cardCodec';
