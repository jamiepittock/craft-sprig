<?php

namespace putyourlightson\sprig\migrations;

use craft\db\Migration;

class m201020_120000_add_playgrounds_table extends Migration
{
    // Public Methods
    // =========================================================================

    /**
     * @inheritdoc
     */
    public function safeUp()
    {
        // Call the install class for upgrades from the beta
        $install = new Install();

        return $install->safeUp();
    }

    /**
     * @inheritdoc
     */
    public function safeDown(): bool
    {
        echo self::class." cannot be reverted.\n";

        return false;
    }
}
