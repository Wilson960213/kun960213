// emotion-manager.js
class EmotionManager {
  constructor() {
    this.affection = 50; // 0-100 亲密值
    this.moodDescriptors = {
      high: '撒娇、开心、话多',
      medium: '平静、偶尔傲娇',
      low: '担心、小声嘀咕、催促'
    };
  }

  addEvent(type) {
    switch(type) {
      case 'milestone': this.affection = Math.min(100, this.affection + 5); break;
      case 'distracted': this.affection = Math.max(0, this.affection - 3); break;
      case 'recovered': this.affection = Math.min(100, this.affection + 3); break;
      case 'pet': this.affection = Math.min(100, this.affection + 10); break;
      default: break;
    }
    console.log('Affection:', this.affection);
  }

  getMood() {
    if (this.affection >= 70) return this.moodDescriptors.high;
    if (this.affection >= 30) return this.moodDescriptors.medium;
    return this.moodDescriptors.low;
  }
}

window.EmotionManager = EmotionManager;