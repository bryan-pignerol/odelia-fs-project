package com.odelia.kanban.security;

import com.odelia.kanban.entity.Board;
import com.odelia.kanban.entity.BoardList;
import com.odelia.kanban.entity.Card;
import com.odelia.kanban.repository.BoardListRepository;
import com.odelia.kanban.repository.BoardMemberRepository;
import com.odelia.kanban.repository.BoardRepository;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.ForbiddenException;

/**
 * Authorization: a board belongs to whoever created it, and that person — or an
 * {@code admin} — may work on it or on anything inside it. On top of that, the
 * owner may invite other users as {@code BoardMember}s, who get real but limited
 * access: they can read and edit the board's columns and cards, but cannot
 * rename or delete the board, and cannot manage its membership.
 *
 * <p>{@code @RolesAllowed} alone only answers "is this a signed-in Kanban
 * user?", which is not enough: every user has the {@code user} role, so without
 * these checks anyone could read someone else's board by guessing its id. The
 * coarse role check and this fine-grained one are complementary.</p>
 *
 * <p>Columns and cards store no owner of their own; they inherit one by walking
 * up to their board. The same walk now also consults {@code BoardMember} so a
 * member's access flows down to the columns and cards of the board.</p>
 *
 * <p>Two levels of access are distinguished:</p>
 * <ul>
 *   <li>{@link #requireBoardAccess(Board)} — owner, member, or admin. Grants
 *       read/write on the board itself and everything inside it (columns, cards).</li>
 *   <li>{@link #requireOwnerOnly(Board)} — owner or admin only. Reserved for
 *       board-level actions: rename, delete, and membership management.</li>
 * </ul>
 */
@RequestScoped
public class BoardAccess {

    @Inject
    CurrentUser currentUser;

    @Inject
    BoardRepository boards;

    @Inject
    BoardListRepository lists;

    @Inject
    BoardMemberRepository members;

    /**
     * Fails with 403 unless the caller is the board's owner, one of its members,
     * or an admin. Use this for everything a collaborator may do: open the board,
     * list its columns, create / edit / move / delete cards and columns.
     */
    public void requireBoardAccess(Board board) {
        if (currentUser.isAdmin()) {
            return;
        }
        if (currentUser.name().equals(board.getOwner())) {
            return;
        }
        if (members.existsByBoardIdAndUsername(board.getId(), currentUser.name())) {
            return;
        }
        throw new ForbiddenException("Board " + board.getId() + " belongs to someone else");
    }

    /**
     * Fails with 403 unless the caller is the board's owner or an admin. Members
     * are <em>not</em> allowed: renaming or deleting the board, and adding or
     * removing members, are owner-only actions.
     */
    public void requireOwnerOnly(Board board) {
        if (currentUser.isAdmin()) {
            return;
        }
        if (currentUser.name().equals(board.getOwner())) {
            return;
        }
        throw new ForbiddenException("Only the owner of board " + board.getId() + " may do that");
    }

    /** The same check, reached through the column's board. */
    public void requireColumnAccess(BoardList column) {
        requireBoardAccess(boardOf(column));
    }

    /** The same check, reached through the card's column and then its board. */
    public void requireCardAccess(Card card) {
        requireColumnAccess(columnOf(card));
    }

    private Board boardOf(BoardList column) {
        return boards.findById(column.getBoardId())
                     .orElseThrow(() -> orphan("column " + column.getId()));
    }

    private BoardList columnOf(Card card) {
        return lists.findById(card.getListId())
                    .orElseThrow(() -> orphan("card " + card.getId()));
    }

    /** With no board to check against, nobody can be shown to own the row: deny. */
    private ForbiddenException orphan(String what) {
        return new ForbiddenException("Cannot establish who owns " + what);
    }
}
