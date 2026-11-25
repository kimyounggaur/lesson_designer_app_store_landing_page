// 진입점: <lesson-claw-machine> 커스텀 엘리먼트를 등록한다.
// 사용법: <script type="module" src=".../claw-machine.js"></script>
//         <lesson-claw-machine apps-src=".../apps.json"></lesson-claw-machine>
import { LessonClawMachine } from './src/element.js';

if (!customElements.get('lesson-claw-machine')) customElements.define('lesson-claw-machine', LessonClawMachine);

export { LessonClawMachine };
