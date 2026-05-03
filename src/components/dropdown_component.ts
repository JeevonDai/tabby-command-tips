/** 命令建议下拉列表组件，支持键盘和鼠标交互选择。 */
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core'

import { MatchResult } from '../services/matching_service'

@Component({
  template: require('./dropdown_component.pug'),
  styles: [require('./dropdown_component.scss')],
})
export class DropdownComponent implements OnChanges {
  @Input() suggestions: MatchResult[] = []
  @Input() currentInput = ''
  @Input() showSourceTag = false
  @Input() visible = false

  @Output() selected = new EventEmitter<string>()
  @Output() cancelled = new EventEmitter<void>()
  @Output() tabPressed = new EventEmitter<void>()

  selectedIndex = 0

  @ViewChild('listContainer') listContainer: ElementRef | null = null

  ngOnChanges (changes: SimpleChanges): void {
    if (changes.suggestions) {
      this.selectedIndex = 0
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown (event: KeyboardEvent): void {
    if (!this.visible || this.suggestions.length === 0) return

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault()
        event.stopPropagation()
        this.moveUp()
        break
      case 'ArrowDown':
        event.preventDefault()
        event.stopPropagation()
        this.moveDown()
        break
      case 'Enter':
        event.preventDefault()
        event.stopPropagation()
        this.confirmSelected()
        break
      case 'Tab':
        event.preventDefault()
        event.stopPropagation()
        this.confirmTab()
        break
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        this.cancel()
        break
    }
  }

  /** 将选中项上移一行。 */
  moveUp (): void {
    if (this.selectedIndex > 0) {
      this.selectedIndex--
      this.scrollToSelected()
    }
  }

  /** 将选中项下移一行。 */
  moveDown (): void {
    if (this.selectedIndex < this.suggestions.length - 1) {
      this.selectedIndex++
      this.scrollToSelected()
    }
  }

  /** 确认当前选中的命令，触发 selected 事件。 */
  confirmSelected (): void {
    if (this.suggestions.length > 0) {
      this.selected.emit(this.suggestions[this.selectedIndex].entry.command)
    }
  }

  confirmTab (): void {
    this.tabPressed.emit()
  }

  /** 取消选择，触发 cancelled 事件。 */
  cancel (): void {
    this.cancelled.emit()
  }

  onItemHover (index: number): void {
    this.selectedIndex = index
  }

  onItemClick (index: number): void {
    this.selectedIndex = index
    this.confirmSelected()
  }

  private scrollToSelected (): void {
    if (!this.listContainer) return
    const container = this.listContainer.nativeElement
    const item = container.children[this.selectedIndex]
    if (item) {
      item.scrollIntoView({ block: 'nearest' })
    }
  }
}
