export interface ColorScheme {
  name: string;
  colors: string[];
  description: string;
}

export class HeatmapColors {
  static readonly schemes: ColorScheme[] = [
 {
      name: 'blues',
      colors: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
      description: 'Blue color scheme for efficiency visualization'
    },
 {
      name: 'reds',
      colors: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'],
      description: 'Red color scheme for heat/usage visualization'
    },
 {
      name: 'greens',
      colors: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
      description: 'Green color scheme for efficiency/optimization'
    },
 {
      name: 'viridis',
      colors: ['#440154', '#482777', '#3f4a8a', '#31678e', '#26838f', '#1f9d8a', '#6cce5a', '#b6de2b', '#fee825'],
      description: 'Viridis color scheme (perceptually uniform)'
    }
  ];

  static getScheme(name: string): ColorScheme {
    return this.schemes.find(s => s.name === name) || this.schemes[0];
  }

  static getUtilizationColor(utilization: number, maxUtilization: number, scheme = 'blues'): string {
    const colors = this.getScheme(scheme).colors;
    const ratio = utilization / maxUtilization;
    const index = Math.floor(ratio * (colors.length - 1));
    return colors[Math.min(index, colors.length - 1)];
  }

  static getEfficiencyColor(efficiency: number, scheme = 'greens'): string {
    const colors = this.getScheme(scheme).colors;
    const index = Math.floor((efficiency / 100) * (colors.length - 1));
    return colors[Math.min(index, colors.length - 1)];
  }

  static getWasteColor(wastePercentage: number, scheme = 'reds'): string {
    const colors = this.getScheme(scheme).colors;
    const index = Math.floor((wastePercentage / 100) * (colors.length - 1));
    return colors[Math.min(index, colors.length - 1)];
  }
}
