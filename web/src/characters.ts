export type Character = { hanzi: string; pinyin: string; meaning: string; group: string }
const groups: Record<string, string[][]> = {
  Numbers: [['一','yī','one'],['二','èr','two'],['三','sān','three'],['四','sì','four'],['五','wǔ','five'],['六','liù','six'],['七','qī','seven'],['八','bā','eight'],['九','jiǔ','nine'],['十','shí','ten']],
  Nature: [['日','rì','sun; day'],['月','yuè','moon; month'],['山','shān','mountain'],['水','shuǐ','water'],['火','huǒ','fire'],['木','mù','tree; wood'],['土','tǔ','earth; soil'],['雨','yǔ','rain'],['天','tiān','sky; day'],['田','tián','field']],
  People: [['人','rén','person'],['口','kǒu','mouth'],['手','shǒu','hand'],['目','mù','eye'],['心','xīn','heart'],['女','nǚ','woman'],['子','zǐ','child'],['大','dà','big'],['小','xiǎo','small'],['好','hǎo','good']],
  Everyday: [['上','shàng','up; above'],['下','xià','down; below'],['中','zhōng','middle'],['我','wǒ','I; me'],['你','nǐ','you'],['不','bù','not'],['是','shì','to be'],['学','xué','to study'],['生','shēng','life; to be born'],['国','guó','country']],
}
export const CHARACTERS: Character[] = Object.entries(groups).flatMap(([group, entries]) => entries.map(([hanzi,pinyin,meaning]) => ({hanzi,pinyin,meaning,group})))
export const GROUPS = Object.keys(groups)
export const findCharacter = (hanzi: string) => CHARACTERS.find(c => c.hanzi === hanzi) ?? CHARACTERS[0]
