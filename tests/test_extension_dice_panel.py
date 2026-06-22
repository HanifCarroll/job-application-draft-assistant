from __future__ import annotations

import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
EXTENSION = REPO_ROOT / "extension"


def read(path: str) -> str:
    return (EXTENSION / path).read_text(encoding="utf-8")


def test_dice_side_panel_routes_action_and_reuses_posting_picker_module() -> None:
    manifest = json.loads((EXTENSION / "manifest.json").read_text(encoding="utf-8"))
    background = read("background.js")
    sidepanel_html = read("sidepanel.html")
    sidepanel = read("sidepanel.js")
    sidepanel_css = read("sidepanel.css")
    draft_sidepanel_html = read("draft_sidepanel.html")
    check_script = (REPO_ROOT / "scripts" / "check").read_text(encoding="utf-8")

    assert manifest["side_panel"]["default_path"] == "sidepanel.html"
    assert "sidePanel" in manifest["permissions"]
    assert "tabs" in manifest["permissions"]
    assert manifest["action"]["default_popup"] == "popup.html"

    assert 'const POPUP_PATH = "popup.html"' in background
    assert 'const SIDE_PANEL_PATH = "sidepanel.html"' in background
    assert 'const DRAFT_SIDE_PANEL_PATH = "draft_sidepanel.html"' in background
    assert "function isDiceUrl" in background
    assert "function isUpworkUrl" in background
    assert "function sidePanelPathForUrl" in background
    assert "if (isUpworkUrl(url)) return DRAFT_SIDE_PANEL_PATH" in background
    assert "chrome.action.setPopup({ tabId, popup: sidePanelPath ? \"\" : POPUP_PATH })" in background
    assert "chrome.sidePanel.setOptions" in background
    assert "chrome.action.onClicked.addListener" in background
    assert "chrome.sidePanel.open({ tabId: tab.id })" in background
    assert "chrome.tabs.onActivated.addListener" in background
    assert "chrome.tabs.onUpdated.addListener" in background

    assert 'src="ui/content_scripts.js"' in sidepanel_html
    assert 'src="ui/dice_posting_picker.js"' in sidepanel_html
    assert 'src="sidepanel.js"' in sidepanel_html
    assert "sidepanel.css" in sidepanel_html
    assert 'src="draft_panel.js"' in draft_sidepanel_html
    assert 'id="draft"' in draft_sidepanel_html
    assert 'id="title"' in draft_sidepanel_html
    assert 'id="description"' in draft_sidepanel_html

    assert "function isDiceResultsUrl" in sidepanel
    assert "function diceResultsTab" in sidepanel
    assert "JobApplicationDicePostingPicker.create" in sidepanel
    assert "JobApplicationContentScripts.inject(tabId)" in sidepanel
    assert 'files: ["content_script.js"]' not in sidepanel
    assert "align-content: start" in sidepanel_css
    assert "grid-auto-rows: max-content" in sidepanel_css
    assert "find extension -name '*.js'" in check_script
    assert "document.title" not in sidepanel
    assert "innerText" not in sidepanel
    assert "[class*=" not in sidepanel


def test_dice_posting_picker_opens_selected_jobs_and_advances_page() -> None:
    picker = read("ui/dice_posting_picker.js")
    popup_html = read("popup.html")
    draft_panel = read("draft_panel.js")

    for field_id in [
        "dice-posting-picker",
        "dice-posting-summary",
        "dice-posting-next-page",
        "dice-posting-select-all",
        "dice-posting-list",
        "dice-posting-open-selected",
        "dice-posting-status",
    ]:
        assert f'id="{field_id}"' in popup_html

    assert "function createDicePostingPicker" in picker
    assert "function nextDiceResultsUrl" in picker
    assert 'url.pathname !== "/jobs"' in picker
    assert 'url.searchParams.set("page"' in picker
    assert "function listPostingsFromTab" in picker
    assert "APPLICATION_DRAFT_LIST_POSTINGS" in picker
    assert "APPLICATION_DRAFT_CLICK_DICE_EASY_APPLY" in picker
    assert "waitForTabComplete" in picker
    assert "chrome.tabs.update(tab.id, { url: nextUrl })" in picker
    assert "openPostingAndClickEasyApply" in picker
    assert "chrome.tabs.create({ url: posting.url, active: false })" in picker
    assert "Promise.all(selectedPostings.map(async (posting) =>" in picker
    assert "await advanceActivePage()" in picker
    assert "Loaded next Dice results page." in picker
    assert "Next page loaded." in picker
    assert "Next page" in popup_html
    assert "Open Easy Apply" in popup_html
    assert "JobApplicationDicePostingPicker.create" in draft_panel
